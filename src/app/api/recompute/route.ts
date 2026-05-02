import { NextRequest } from "next/server";
import { successJson, errorJson } from "@/lib/api-utils";
import { supabase } from "@/lib/supabase/client";

let isRunning = false;

interface RecomputeWeights {
  readonly virality: number;
  readonly recency: number;
  readonly researchInterest: number;
}

const DEFAULT_WEIGHTS: RecomputeWeights = {
  virality: 50,
  recency: 50,
  researchInterest: 50,
};

function computeScore(
  article: {
    engagement_metrics: Record<string, unknown>;
    published_at: string | null;
    content_type: string;
    platform: string;
  },
  weights: RecomputeWeights,
): number {
  const now = Date.now();

  // Virality: derive from engagement metrics
  const metrics = article.engagement_metrics ?? {};
  const stars = Number(metrics.stars ?? 0);
  const points = Number(metrics.points ?? 0);
  const upvotes = Number(metrics.upvotes ?? 0);
  const citations = Number(metrics.citations ?? 0);
  const comments = Number(metrics.comments ?? 0);
  const rawEngagement = stars + points + upvotes + citations * 5 + comments * 0.5;
  const viralityScore =
    rawEngagement > 0 ? Math.min(100, (Math.log10(rawEngagement) / 3) * 100) : 0;

  // Recency: exponential decay over 30 days
  const publishedAt = article.published_at ? new Date(article.published_at).getTime() : 0;
  const ageHours = Math.max(0, (now - publishedAt) / (1000 * 60 * 60));
  const recencyScore = Math.max(0, 100 * Math.exp(-ageHours / (30 * 24)));

  // Research interest: papers and arxiv get higher base scores
  const isResearch =
    article.content_type === "paper" ||
    article.platform === "arxiv" ||
    article.platform === "semantic_scholar";
  const researchBase = isResearch ? 70 : 20;

  // Citation velocity: citations per day since publishing (dynamic scoring)
  const daysSince =
    publishedAt > 0 ? Math.max(1, (now - publishedAt) / (1000 * 60 * 60 * 24)) : 365;
  const velocity = citations / daysSince;
  const weeklyVelocity = velocity * 7;
  // log2 scale: 0 vel→0, 1/wk→0.5, 7/wk→1.5, 35/wk→2.6 — maps to 0-30 boost
  const velocityBoost = citations > 0 ? Math.min(30, (Math.log2(1 + weeklyVelocity) / 2) * 10) : 0;
  const researchScore = Math.min(100, researchBase + velocityBoost);

  // Weighted combination (weights are 0-100, normalize to fractions)
  const totalWeight = weights.virality + weights.recency + weights.researchInterest;
  if (totalWeight === 0) return 0;

  const score =
    (viralityScore * weights.virality +
      recencyScore * weights.recency +
      researchScore * weights.researchInterest) /
    totalWeight;

  return Math.round(score * 100) / 100;
}

export async function POST(request: NextRequest) {
  if (isRunning) {
    return errorJson("Recompute is already running. Please wait.", 409);
  }

  const body = await request.json().catch(() => ({}));
  const weights: RecomputeWeights = {
    virality: Number(body.virality ?? DEFAULT_WEIGHTS.virality),
    recency: Number(body.recency ?? DEFAULT_WEIGHTS.recency),
    researchInterest: Number(body.researchInterest ?? DEFAULT_WEIGHTS.researchInterest),
  };

  isRunning = true;

  try {
    // Fetch all articles
    const { data, error } = await supabase
      .from("articles")
      .select("id, engagement_metrics, published_at, content_type, platform");

    if (error) throw new Error(`Failed to fetch articles: ${error.message}`);

    const articles = data ?? [];
    let updated = 0;

    // Process in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const updates = batch.map((article) => ({
        id: article.id,
        engagement_score: computeScore(article, weights),
      }));

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("articles")
          .update({ engagement_score: update.engagement_score })
          .eq("id", update.id);

        if (!updateError) updated++;
      }
    }

    return successJson({ total: articles.length, updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recompute failed";
    return errorJson(message, 500);
  } finally {
    isRunning = false;
  }
}
