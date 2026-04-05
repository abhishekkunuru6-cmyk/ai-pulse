/**
 * LLM-powered article ranking and topic intelligence.
 *
 * Uses Gemini (free tier) to add "smartness" to article selection:
 * - Rerank digest articles by contextual importance (not just numbers)
 * - Generate intelligent topic labels and hotness assessments
 * - Assess what's truly trending vs just noisy
 *
 * All results are cached (Upstash Redis) to stay within free tier rate limits.
 * Falls back to numeric ranking if Gemini is unavailable.
 */

import { generateWithGemini } from "@/lib/gemini";
import { cacheGet, cacheSet } from "@/lib/cache";

// ── Types ──────────────────────────────────────────────────────────────────

interface ArticleSummary {
  readonly id: string;
  readonly title: string;
  readonly platform: string;
  readonly content_type: string;
  readonly topic_tags: readonly string[];
  readonly summary_snippet: string | null;
  readonly engagement_score: number | null;
  readonly published_at: string | null;
}

interface RerankResult {
  /** Ordered list of article IDs from most to least important */
  readonly rankedIds: readonly string[];
  /** Whether the result came from LLM (true) or fallback (false) */
  readonly llmPowered: boolean;
}

interface TopicAssessment {
  readonly label: string;
  readonly hotnessScore: number;
  readonly reason: string;
}

interface ClusterInput {
  readonly slug: string;
  readonly currentLabel: string;
  readonly articleTitles: readonly string[];
  readonly platforms: readonly string[];
  readonly articleCount: number;
  readonly avgEngagement: number;
}

// ── Cache helpers ──────────────────────────────────────────────────────────

const RERANK_CACHE_TTL = 3600; // 1 hour
const TOPIC_CACHE_TTL = 3600; // 1 hour

function rerankCacheKey(period: string, limit: number): string {
  const date = new Date().toISOString().slice(0, 13); // per-hour granularity
  return `llm-rerank:${period}:${limit}:${date}`;
}

function topicCacheKey(timeRange: string): string {
  const date = new Date().toISOString().slice(0, 13);
  return `llm-topics:${timeRange}:${date}`;
}

// ── Digest reranking ───────────────────────────────────────────────────────

function buildRerankPrompt(
  articles: readonly ArticleSummary[],
  count: number,
  period: string,
): string {
  const timeLabel =
    period === "daily"
      ? "past 24 hours"
      : period === "weekly"
        ? "past week"
        : period === "monthly"
          ? "past month"
          : period === "yearly"
            ? "past year"
            : "all time";

  const articleList = articles
    .map((a, i) => {
      const engagement = Number(a.engagement_score) || 0;
      const snippet = a.summary_snippet ? ` — ${a.summary_snippet.slice(0, 100)}` : "";
      return `${i + 1}. [${a.platform}/${a.content_type}] "${a.title}"${snippet} (engagement: ${engagement.toFixed(1)}, tags: ${a.topic_tags.join(", ") || "none"})`;
    })
    .join("\n");

  return `You are an AI news curator selecting the ${count} most important articles from the ${timeLabel} for a senior AI engineer.

CANDIDATE ARTICLES:
${articleList}

SELECTION CRITERIA (in priority order):
1. **Breakthrough importance**: Major new models, techniques, or discoveries that change the field
2. **Practical impact**: Tools, libraries, or findings that engineers can use immediately
3. **Trending momentum**: Topics that multiple sources are covering simultaneously (cross-platform signal)
4. **Diversity**: Mix of research papers, tools/code, news, and community discussions — don't pick 5 papers in a row
5. **Novelty**: Prefer genuinely new information over rehashed takes on old topics

ANTI-PATTERNS TO AVOID:
- Don't pick articles just because they have high engagement — viral Reddit memes are noisy
- Don't over-index on any single platform
- Don't pick near-duplicate articles covering the same story
- Don't pick low-substance announcements ("X releases Y" with no technical depth)

RESPOND WITH ONLY a JSON array of the original article numbers (1-indexed), in order from most important to least. Pick exactly ${count}.
Example: [3, 7, 1, 15, 9, 2, 12, 4, 6, 8]

JSON array:`;
}

/**
 * Use Gemini to intelligently select and rank the top N articles from a larger candidate pool.
 * Falls back to the original order (by engagement score) if Gemini is unavailable.
 */
export async function rerankDigestArticles(
  candidates: readonly ArticleSummary[],
  count: number,
  period: string,
): Promise<RerankResult> {
  // If candidates <= count, no reranking needed
  if (candidates.length <= count) {
    return { rankedIds: candidates.map((a) => a.id), llmPowered: false };
  }

  const cacheKey = rerankCacheKey(period, count);

  // Check cache first
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { rankedIds: string[] };
      // Validate cached IDs still match current candidates
      const candidateIds = new Set(candidates.map((a) => a.id));
      const validIds = parsed.rankedIds.filter((id) => candidateIds.has(id));
      if (validIds.length >= count * 0.8) {
        return { rankedIds: validIds.slice(0, count), llmPowered: true };
      }
    }
  } catch {
    // Cache miss or parse error — proceed to LLM
  }

  // Send top candidates to Gemini (cap at 80 to keep prompt reasonable)
  const topCandidates = candidates.slice(0, 80);
  const prompt = buildRerankPrompt(topCandidates, count, period);

  try {
    const response = await generateWithGemini(prompt);

    // Parse the JSON array from response
    const jsonMatch = response.match(/\[[\d\s,]+\]/);
    if (!jsonMatch) {
      return { rankedIds: candidates.slice(0, count).map((a) => a.id), llmPowered: false };
    }

    const indices: number[] = JSON.parse(jsonMatch[0]);
    const rankedIds = indices
      .filter((i) => i >= 1 && i <= topCandidates.length)
      .map((i) => topCandidates[i - 1].id)
      .slice(0, count);

    // If LLM returned too few, pad with remaining candidates
    if (rankedIds.length < count) {
      const selected = new Set(rankedIds);
      for (const a of candidates) {
        if (rankedIds.length >= count) break;
        if (!selected.has(a.id)) {
          rankedIds.push(a.id);
          selected.add(a.id);
        }
      }
    }

    const result: RerankResult = { rankedIds, llmPowered: true };

    // Cache the result
    cacheSet(cacheKey, JSON.stringify({ rankedIds }), RERANK_CACHE_TTL).catch(() => {});

    return result;
  } catch {
    // Gemini unavailable — fallback to numeric ranking
    return { rankedIds: candidates.slice(0, count).map((a) => a.id), llmPowered: false };
  }
}

// ── Topic intelligence ─────────────────────────────────────────────────────

function buildTopicAssessmentPrompt(clusters: readonly ClusterInput[]): string {
  const clusterList = clusters
    .map(
      (c, i) =>
        `${i + 1}. "${c.currentLabel}" — ${c.articleCount} articles from [${c.platforms.join(", ")}], avg engagement ${c.avgEngagement.toFixed(1)}\n   Titles: ${c.articleTitles.slice(0, 5).join(" | ")}`,
    )
    .join("\n");

  return `You are an AI trend analyst. Assess these topic clusters from an AI news aggregator.

CLUSTERS:
${clusterList}

For each cluster, provide:
1. A better, more descriptive label (2-5 words, specific — not generic like "AI Research")
2. A hotness score 0-100 (how much buzz/importance this topic has RIGHT NOW)
3. A one-sentence reason explaining why it's hot or not

RESPOND WITH ONLY a JSON array of objects, one per cluster, in the same order:
[{"label": "...", "hotness": 85, "reason": "..."}, ...]

JSON array:`;
}

/**
 * Use Gemini to assess topic clusters — better labels, contextual hotness scores, and reasons.
 * Falls back to the original labels and numeric scores if Gemini is unavailable.
 */
export async function assessTopicClusters(
  clusters: readonly ClusterInput[],
  timeRange: string,
): Promise<readonly TopicAssessment[] | null> {
  if (clusters.length === 0) return null;

  const cacheKey = topicCacheKey(timeRange);

  // Check cache
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TopicAssessment[];
    }
  } catch {
    // Cache miss
  }

  const prompt = buildTopicAssessmentPrompt(clusters.slice(0, 20));

  try {
    const response = await generateWithGemini(prompt);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const assessments: TopicAssessment[] = JSON.parse(jsonMatch[0]);

    // Validate
    const validated = assessments.slice(0, clusters.length).map((a) => {
      const raw = a as unknown as {
        hotness?: number;
        hotnessScore?: number;
        label?: string;
        reason?: string;
      };
      const score =
        typeof raw.hotness === "number"
          ? raw.hotness
          : typeof raw.hotnessScore === "number"
            ? raw.hotnessScore
            : 50;
      return {
        label: typeof raw.label === "string" ? raw.label.slice(0, 60) : "Unknown",
        hotnessScore: Math.max(0, Math.min(100, Math.round(score))),
        reason: typeof raw.reason === "string" ? raw.reason.slice(0, 200) : "",
      };
    });

    // Cache for 1 hour
    cacheSet(cacheKey, JSON.stringify(validated), TOPIC_CACHE_TTL).catch(() => {});

    return validated;
  } catch {
    return null;
  }
}

// ── Batch hotness scoring ──────────────────────────────────────────────────

interface HotnessInput {
  readonly id: string;
  readonly title: string;
  readonly platform: string;
  readonly content_type: string;
  readonly topic_tags: readonly string[];
  readonly currentScore: number;
}

interface HotnessOutput {
  readonly id: string;
  readonly adjustedScore: number;
  readonly reason: string;
}

function buildHotnessPrompt(articles: readonly HotnessInput[]): string {
  const list = articles
    .map(
      (a, i) =>
        `${i + 1}. "${a.title}" [${a.platform}/${a.content_type}] current_score=${a.currentScore.toFixed(1)} tags=[${a.topic_tags.join(",")}]`,
    )
    .join("\n");

  return `You are an AI relevance engine. Rate these articles on a scale of 0-100 based on how important they are for a senior AI engineer to know about RIGHT NOW.

Consider:
- Is this a genuine breakthrough or just incremental?
- Is this practically useful or purely theoretical?
- Is this timely (trending topic) or stale news?
- Would missing this leave a knowledge gap?

ARTICLES:
${list}

RESPOND WITH ONLY a JSON array, one per article:
[{"index": 1, "score": 85, "reason": "Major new open model release"}, ...]

JSON array:`;
}

/**
 * Use Gemini to assess the true importance of articles, overriding pure engagement metrics.
 * Processes in batches. Falls back to original scores if Gemini is unavailable.
 */
export async function assessArticleHotness(
  articles: readonly HotnessInput[],
): Promise<readonly HotnessOutput[] | null> {
  if (articles.length === 0) return null;

  // Process in batches of 30 to keep prompts manageable
  const BATCH_SIZE = 30;
  const results: HotnessOutput[] = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const prompt = buildHotnessPrompt(batch);

    try {
      const response = await generateWithGemini(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const parsed: Array<{ index: number; score: number; reason: string }> = JSON.parse(
        jsonMatch[0],
      );

      for (const item of parsed) {
        const articleIndex = item.index - 1;
        if (articleIndex >= 0 && articleIndex < batch.length) {
          results.push({
            id: batch[articleIndex].id,
            adjustedScore: Math.max(0, Math.min(100, item.score)),
            reason: item.reason ?? "",
          });
        }
      }
    } catch {
      // Batch failed — keep original scores for this batch
      for (const a of batch) {
        results.push({
          id: a.id,
          adjustedScore: a.currentScore,
          reason: "LLM unavailable — using numeric score",
        });
      }
    }
  }

  return results.length > 0 ? results : null;
}

// ── Personalized relevance scoring ────────────────────────────────────────

interface RelevanceInput {
  readonly id: string;
  readonly title: string;
  readonly platform: string;
  readonly content_type: string;
  readonly topic_tags: readonly string[];
  readonly summary_snippet: string | null;
}

interface RelevanceOutput {
  readonly id: string;
  readonly relevanceScore: number;
  readonly reason: string;
}

interface UserTasteContext {
  readonly likedTags: readonly string[];
  readonly dislikedTags: readonly string[];
  readonly preferredPlatforms: readonly string[];
  readonly preferredContentTypes: readonly string[];
  readonly boostedKeywords: readonly string[];
  readonly blockedKeywords: readonly string[];
  readonly likedTitles: readonly string[];
  readonly dislikedTitles: readonly string[];
}

function buildRelevancePrompt(
  articles: readonly RelevanceInput[],
  taste: UserTasteContext,
): string {
  const articleList = articles
    .map((a, i) => {
      const snippet = a.summary_snippet ? ` — ${a.summary_snippet.slice(0, 80)}` : "";
      return `${i + 1}. "${a.title}"${snippet} [${a.platform}/${a.content_type}] tags=[${a.topic_tags.join(",")}]`;
    })
    .join("\n");

  const likedSection =
    taste.likedTitles.length > 0
      ? `\nARTICLES THE USER LIKED:\n${taste.likedTitles
          .slice(0, 10)
          .map((t) => `- "${t}"`)
          .join("\n")}`
      : "";

  const dislikedSection =
    taste.dislikedTitles.length > 0
      ? `\nARTICLES THE USER DISLIKED:\n${taste.dislikedTitles
          .slice(0, 5)
          .map((t) => `- "${t}"`)
          .join("\n")}`
      : "";

  return `You are a personal AI news curator. Rate these articles on a scale of 0-100 based on how relevant they are to THIS SPECIFIC USER's interests.

USER PROFILE:
- Favorite topics: ${taste.likedTags.join(", ") || "not enough data yet"}
- Topics to avoid: ${taste.dislikedTags.join(", ") || "none"}
- Preferred platforms: ${taste.preferredPlatforms.join(", ") || "no preference"}
- Preferred content types: ${taste.preferredContentTypes.join(", ") || "no preference"}
- Boosted keywords (user explicitly wants these): ${taste.boostedKeywords.join(", ") || "none"}
- Blocked keywords (user explicitly avoids these): ${taste.blockedKeywords.join(", ") || "none"}
${likedSection}
${dislikedSection}

ARTICLES TO SCORE:
${articleList}

Score each article 0-100 where:
- 90-100: Perfectly matches user interests — must read
- 70-89: Strong match — highly relevant
- 50-69: Moderate match — might be interesting
- 30-49: Weak match — probably skip
- 0-29: Not relevant — user would not care

RESPOND WITH ONLY a JSON array, one per article:
[{"index": 1, "score": 85, "reason": "Matches user's interest in X"}, ...]

JSON array:`;
}

const RELEVANCE_CACHE_TTL = 3600; // 1 hour

function relevanceCacheKey(): string {
  const date = new Date().toISOString().slice(0, 13);
  return `llm-relevance:${date}`;
}

/**
 * Use Gemini to score articles by personalized relevance based on the user's taste profile.
 * Falls back to null if Gemini is unavailable (caller should use formula-based fallback).
 */
export async function assessPersonalizedRelevance(
  articles: readonly RelevanceInput[],
  taste: UserTasteContext,
): Promise<readonly RelevanceOutput[] | null> {
  if (articles.length === 0) return null;

  const cacheKey = relevanceCacheKey();

  // Check cache
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as RelevanceOutput[];
      // Validate cached IDs match at least 80% of current articles
      const articleIds = new Set(articles.map((a) => a.id));
      const validEntries = parsed.filter((e) => articleIds.has(e.id));
      if (validEntries.length >= articles.length * 0.8) {
        return validEntries;
      }
    }
  } catch {
    // Cache miss
  }

  // Process in batches of 25
  const BATCH_SIZE = 25;
  const results: RelevanceOutput[] = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const prompt = buildRelevancePrompt(batch, taste);

    try {
      const response = await generateWithGemini(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const parsed: Array<{ index: number; score: number; reason: string }> = JSON.parse(
        jsonMatch[0],
      );

      for (const item of parsed) {
        const articleIndex = item.index - 1;
        if (articleIndex >= 0 && articleIndex < batch.length) {
          results.push({
            id: batch[articleIndex].id,
            relevanceScore: Math.max(0, Math.min(100, item.score)),
            reason: item.reason ?? "",
          });
        }
      }
    } catch {
      // Batch failed — skip (caller will use fallback)
    }
  }

  // Cache results
  if (results.length > 0) {
    cacheSet(cacheKey, JSON.stringify(results), RELEVANCE_CACHE_TTL).catch(() => {});
  }

  return results.length > 0 ? results : null;
}
