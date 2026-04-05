import { NextRequest } from "next/server";
import { successJson, errorJson } from "@/lib/api-utils";
import { supabase } from "@/lib/supabase/client";
import { buildTasteProfile, computeFallbackRelevance } from "@/lib/user-profile";
import { assessPersonalizedRelevance } from "@/lib/llm-ranker";
import type { Article } from "@/types";

/**
 * POST /api/relevance
 * Triggers LLM-powered relevance scoring for recent articles.
 * Body: { boostedKeywords?: string[], blockedKeywords?: string[], limit?: number }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const boostedKeywords: string[] = Array.isArray(body.boostedKeywords)
    ? body.boostedKeywords
    : [];
  const blockedKeywords: string[] = Array.isArray(body.blockedKeywords)
    ? body.blockedKeywords
    : [];
  const limit = typeof body.limit === "number" ? Math.min(body.limit, 200) : 100;

  try {
    // 1. Build taste profile from preferences + keywords
    const profile = await buildTasteProfile(boostedKeywords, blockedKeywords);

    if (!profile) {
      return successJson({
        scored: 0,
        message: "No preferences yet — like or dislike some articles first.",
      });
    }

    // 2. Fetch recent articles to score
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, platform, content_type, topic_tags, summary_snippet")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch articles: ${error.message}`);
    if (!articles || articles.length === 0) {
      return successJson({ scored: 0, message: "No articles to score." });
    }

    const typedArticles = articles as Array<{
      id: string;
      title: string;
      platform: string;
      content_type: string;
      topic_tags: string[];
      summary_snippet: string | null;
    }>;

    // 3. Try LLM-powered scoring first
    const llmResults = await assessPersonalizedRelevance(typedArticles, profile);

    // 4. Build final scores — LLM results + fallback for any articles LLM missed
    const llmScoreMap = new Map(
      (llmResults ?? []).map((r) => [r.id, r.relevanceScore]),
    );

    const updates: Array<{ id: string; score: number }> = [];

    for (const article of typedArticles) {
      const llmScore = llmScoreMap.get(article.id);
      const score =
        llmScore !== undefined
          ? llmScore
          : computeFallbackRelevance(article, profile);
      updates.push({ id: article.id, score });
    }

    // 5. Batch update relevance_score in database
    let updatedCount = 0;
    for (const { id, score } of updates) {
      const { error: updateError } = await supabase
        .from("articles")
        .update({ relevance_score: score })
        .eq("id", id);

      if (!updateError) updatedCount++;
    }

    return successJson({
      scored: updatedCount,
      llmPowered: llmResults !== null,
      profileStrength: profile.totalPreferences,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Relevance scoring failed";
    return errorJson(message, 500);
  }
}
