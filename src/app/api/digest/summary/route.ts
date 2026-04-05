import { NextRequest } from "next/server";
import { successJson, errorJson, parseSearchParams } from "@/lib/api-utils";
import { digestSchema } from "@/lib/schemas";
import { getDigestArticles } from "@/lib/repositories";
import { generateWithGemini } from "@/lib/gemini";
import { cacheGet, cacheSet } from "@/lib/cache";

interface DigestSummaryResult {
  readonly summary: string;
  readonly articleCount: number;
  readonly period: string;
}

/** Cache key format: digest-summary:daily:2026-03-27 */
function buildCacheKey(period: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `digest-summary:${period}:${date}`;
}

function buildPrompt(
  articles: readonly {
    title: string;
    platform: string;
    summary_snippet: string | null;
    topic_tags: readonly string[];
  }[],
  period: string,
): string {
  const timeframe = period === "daily" ? "past 24 hours" : "past week";
  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.platform}] ${a.title}${a.summary_snippet ? ` — ${a.summary_snippet}` : ""}${a.topic_tags.length > 0 ? ` (${a.topic_tags.join(", ")})` : ""}`,
    )
    .join("\n");

  return `You are a senior AI analyst writing a concise intelligence briefing. Based on these ${articles.length} top AI articles from the ${timeframe}, write a briefing.

ARTICLES:
${articleList}

RULES:
- Write exactly 4 short paragraphs, each 2-3 sentences max
- Paragraph 1: The single biggest theme or story — what dominates the news
- Paragraph 2: Notable releases, tools, or repos gaining traction
- Paragraph 3: Research highlights — interesting papers or breakthroughs
- Paragraph 4: One-line "Bottom line" takeaway starting with "Bottom line:"
- Be specific — name actual projects, models, and tools
- Skip generic filler like "the AI landscape continues to evolve"
- Do NOT use markdown formatting, bullet points, or headers
- Do NOT say "Good morning" or address anyone
- Write in present tense, direct and punchy`;
}

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams, digestSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  const period = parsed.data.period === "monthly" ? "weekly" : parsed.data.period;
  const force = request.nextUrl.searchParams.get("force") === "1";
  const key = buildCacheKey(period);

  try {
    // Check cache first (unless force refresh)
    if (!force) {
      const cached = await cacheGet(key);
      if (cached) {
        try {
          return successJson(JSON.parse(cached) as DigestSummaryResult);
        } catch {
          // Corrupted cache — regenerate
        }
      }
    }

    const articles = await getDigestArticles(period, 20);

    if (articles.length === 0) {
      return successJson({
        summary: "No recent articles to summarize. Check back after the next ingestion run.",
        articleCount: 0,
        period,
      });
    }

    const prompt = buildPrompt(articles, period);
    const summary = await generateWithGemini(prompt);

    const result: DigestSummaryResult = { summary, articleCount: articles.length, period };

    // Cache for 6 hours (21600s) — fire and forget
    cacheSet(key, JSON.stringify(result), 21600).catch(() => {});

    return successJson(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate summary";
    return errorJson(message, 500);
  }
}
