/**
 * Builds a user taste profile from like/dislike history + settings keywords.
 * Used by the LLM relevance scorer to assess personalized article importance.
 */

import { supabase } from "@/lib/supabase/client";

export interface TasteProfile {
  /** Tags the user tends to like */
  readonly likedTags: readonly string[];
  /** Tags the user tends to dislike */
  readonly dislikedTags: readonly string[];
  /** Platforms the user engages with positively */
  readonly preferredPlatforms: readonly string[];
  /** Content types the user likes */
  readonly preferredContentTypes: readonly string[];
  /** User-configured boosted keywords from settings */
  readonly boostedKeywords: readonly string[];
  /** User-configured blocked keywords from settings */
  readonly blockedKeywords: readonly string[];
  /** Sample liked article titles (for LLM context) */
  readonly likedTitles: readonly string[];
  /** Sample disliked article titles (for LLM context) */
  readonly dislikedTitles: readonly string[];
  /** Total preferences count */
  readonly totalPreferences: number;
}

interface PreferenceRow {
  readonly rating: "up" | "down";
  readonly article_id: string;
}

interface ArticleRow {
  readonly id: string;
  readonly title: string;
  readonly topic_tags: readonly string[];
  readonly platform: string;
  readonly content_type: string;
}

/**
 * Build a taste profile from the user's article preferences and settings keywords.
 * Returns null if the user has no preferences yet (cold start).
 */
export async function buildTasteProfile(
  boostedKeywords: readonly string[] = [],
  blockedKeywords: readonly string[] = [],
): Promise<TasteProfile | null> {
  // Fetch all preferences
  const { data: preferences, error: prefError } = await supabase
    .from("article_preferences")
    .select("rating, article_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (prefError || !preferences || preferences.length === 0) {
    // Cold start — return a minimal profile from keywords only if available
    if (boostedKeywords.length > 0 || blockedKeywords.length > 0) {
      return {
        likedTags: [],
        dislikedTags: [],
        preferredPlatforms: [],
        preferredContentTypes: [],
        boostedKeywords,
        blockedKeywords,
        likedTitles: [],
        dislikedTitles: [],
        totalPreferences: 0,
      };
    }
    return null;
  }

  const typedPrefs = preferences as PreferenceRow[];
  const likedIds = typedPrefs.filter((p) => p.rating === "up").map((p) => p.article_id);
  const dislikedIds = typedPrefs.filter((p) => p.rating === "down").map((p) => p.article_id);

  // Fetch article details for liked and disliked articles
  const allIds = [...likedIds, ...dislikedIds].slice(0, 200);
  if (allIds.length === 0) return null;

  const { data: articles, error: artError } = await supabase
    .from("articles")
    .select("id, title, topic_tags, platform, content_type")
    .in("id", allIds);

  if (artError || !articles) return null;

  const articleMap = new Map((articles as ArticleRow[]).map((a) => [a.id, a]));

  // Aggregate liked/disliked signals
  const tagCounts = new Map<string, number>();
  const platformCounts = new Map<string, number>();
  const contentTypeCounts = new Map<string, number>();
  const likedTitles: string[] = [];
  const dislikedTitles: string[] = [];

  for (const id of likedIds) {
    const article = articleMap.get(id);
    if (!article) continue;
    likedTitles.push(article.title);
    for (const tag of article.topic_tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    platformCounts.set(article.platform, (platformCounts.get(article.platform) ?? 0) + 1);
    contentTypeCounts.set(
      article.content_type,
      (contentTypeCounts.get(article.content_type) ?? 0) + 1,
    );
  }

  const dislikedTagCounts = new Map<string, number>();
  for (const id of dislikedIds) {
    const article = articleMap.get(id);
    if (!article) continue;
    dislikedTitles.push(article.title);
    for (const tag of article.topic_tags) {
      dislikedTagCounts.set(tag, (dislikedTagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Extract top signals
  const likedTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const dislikedTags = [...dislikedTagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const preferredPlatforms = [...platformCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  const preferredContentTypes = [...contentTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ct]) => ct);

  return {
    likedTags,
    dislikedTags,
    preferredPlatforms,
    preferredContentTypes,
    boostedKeywords,
    blockedKeywords,
    likedTitles: likedTitles.slice(0, 15),
    dislikedTitles: dislikedTitles.slice(0, 10),
    totalPreferences: typedPrefs.length,
  };
}

/**
 * Formula-based fallback relevance scoring when Gemini is unavailable.
 * Uses tag/platform/keyword overlap with the user's taste profile.
 */
export function computeFallbackRelevance(
  article: {
    readonly title: string;
    readonly topic_tags: readonly string[];
    readonly platform: string;
    readonly content_type: string;
  },
  profile: TasteProfile,
): number {
  let score = 50; // neutral baseline

  const titleLower = article.title.toLowerCase();

  // Tag overlap with liked tags: +8 per match
  for (const tag of article.topic_tags) {
    if (profile.likedTags.includes(tag)) score += 8;
    if (profile.dislikedTags.includes(tag)) score -= 8;
  }

  // Platform preference: +5
  if (profile.preferredPlatforms.includes(article.platform)) score += 5;

  // Content type preference: +5
  if (profile.preferredContentTypes.includes(article.content_type)) score += 5;

  // Boosted keywords: +10 per match
  for (const kw of profile.boostedKeywords) {
    if (titleLower.includes(kw.toLowerCase())) score += 10;
  }

  // Blocked keywords: -15 per match
  for (const kw of profile.blockedKeywords) {
    if (titleLower.includes(kw.toLowerCase())) score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
