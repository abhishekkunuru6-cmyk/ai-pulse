import { supabase } from "@/lib/supabase/client";
import type { Article } from "@/types";
import type { ArticleFilterInput } from "@/lib/schemas";
import { PAGINATION } from "@/constants";
import { deduplicateFeed } from "@/lib/utils/dedup-feed";
import { diversifyByPlatform } from "@/lib/utils/diversify-feed";

function escapePostgrestString(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

interface PaginatedArticles {
  readonly articles: readonly Article[];
  readonly cursor: string | null;
  readonly has_more: boolean;
}

export async function getArticles(filters: ArticleFilterInput): Promise<PaginatedArticles> {
  const limit = filters.limit ?? PAGINATION.DEFAULT_LIMIT;

  let query = supabase.from("articles").select("*", { count: "exact" });

  // Cursor-based pagination
  if (filters.cursor) {
    const { data: cursorArticle } = await supabase
      .from("articles")
      .select("published_at")
      .eq("id", filters.cursor)
      .single();
    if (cursorArticle?.published_at) {
      query = query.lt("published_at", cursorArticle.published_at);
    }
  }

  // Content type filter
  if (filters.content_type && filters.content_type.length > 0) {
    query = query.in("content_type", [...filters.content_type]);
  }

  // Platform filter
  if (filters.platform && filters.platform.length > 0) {
    query = query.in("platform", [...filters.platform]);
  }

  // Time range filter
  if (filters.time_range && filters.time_range !== "all") {
    const now = new Date();
    let since: Date;
    switch (filters.time_range) {
      case "today":
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "three_months":
        since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "six_months":
        since = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
    query = query.gte("published_at", since!.toISOString());
  }

  // Custom time range
  if (filters.time_from) {
    query = query.gte("published_at", filters.time_from);
  }
  if (filters.time_to) {
    query = query.lte("published_at", filters.time_to);
  }

  // Topic filter (array overlap)
  if (filters.topic && filters.topic.length > 0) {
    query = query.overlaps("topic_tags", [...filters.topic]);
  }

  // Read status filter
  if (filters.read_status) {
    switch (filters.read_status) {
      case "unread":
        query = query.eq("is_read", false);
        break;
      case "read":
        query = query.eq("is_read", true);
        break;
      case "saved":
        query = query.eq("is_saved", true);
        break;
    }
  }

  // Engagement sort
  if (filters.engagement === "trending") {
    query = query.order("engagement_score", { ascending: false });
  } else if (filters.engagement === "under_the_radar") {
    query = query.order("engagement_score", { ascending: true });
  } else {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  }

  // Fetch a large pool so minority platforms are represented after diversity filtering.
  // High-volume sources (Reddit, HN) can be 70%+ of recent articles, and high-scoring
  // platforms (GitHub) can push low-engagement platforms out of a score-sorted pool.
  query = query.limit(Math.max(limit * 10, 500));

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch articles: ${error.message}`);

  const rawArticles = (data ?? []) as Article[];

  // Remove near-duplicate articles (same content from multiple platforms)
  const deduped = deduplicateFeed(rawArticles);

  // Enforce platform diversity: no single platform dominates the feed
  // Skip diversity when user explicitly filters by platform
  const userFilteredByPlatform = (filters.platform?.length ?? 0) > 0;
  const diverse = userFilteredByPlatform ? deduped : diversifyByPlatform(deduped, limit + 1);

  const has_more = diverse.length > limit;
  const sliced = has_more ? diverse.slice(0, limit) : diverse;
  const cursor = has_more && sliced.length > 0 ? sliced[sliced.length - 1].id : null;

  return { articles: sliced, cursor, has_more };
}

export async function getArticleById(id: string): Promise<Article | null> {
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch article: ${error.message}`);
  }
  return data as Article;
}

export async function markArticleRead(id: string): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({ is_read: true })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") throw new Error("Article not found.");
    throw new Error(`Failed to mark article as read: ${error.message}`);
  }
  return data as Article;
}

export async function toggleArticleSave(id: string): Promise<Article> {
  const current = await getArticleById(id);
  if (!current) throw new Error("Article not found.");

  const { data, error } = await supabase
    .from("articles")
    .update({ is_saved: !current.is_saved })
    .eq("id", id)
    .eq("is_saved", current.is_saved) // optimistic lock guard
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Concurrent modification detected. Please retry.");
    }
    throw new Error(`Failed to toggle save: ${error.message}`);
  }
  return data as Article;
}

export async function getSavedArticles(): Promise<readonly Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_saved", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Failed to fetch saved articles: ${error.message}`);
  return (data ?? []) as Article[];
}

export async function searchArticles(
  query: string,
  cursor?: string,
  limit: number = PAGINATION.DEFAULT_LIMIT,
): Promise<PaginatedArticles> {
  let dbQuery = supabase
    .from("articles")
    .select("*")
    .or(
      `title.ilike.%${escapePostgrestString(query)}%,summary_snippet.ilike.%${escapePostgrestString(query)}%`,
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit + 1);

  if (cursor) {
    const { data: cursorArticle } = await supabase
      .from("articles")
      .select("published_at")
      .eq("id", cursor)
      .single();
    if (cursorArticle?.published_at) {
      dbQuery = dbQuery.lt("published_at", cursorArticle.published_at);
    }
  }

  const { data, error } = await dbQuery;
  if (error) throw new Error(`Failed to search articles: ${error.message}`);

  const articles = (data ?? []) as Article[];
  const has_more = articles.length > limit;
  const sliced = has_more ? articles.slice(0, limit) : articles;
  const nextCursor = has_more && sliced.length > 0 ? sliced[sliced.length - 1].id : null;

  return { articles: sliced, cursor: nextCursor, has_more };
}

import type { DigestPeriod } from "@/lib/schemas";

const PERIOD_MS: Record<Exclude<DigestPeriod, "all">, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

const PERIOD_HALF_LIFE: Record<DigestPeriod, number> = {
  daily: 24,
  weekly: 72,
  monthly: 168,
  yearly: 720,
  all: 2160,
};

export async function getDigestArticles(
  period: DigestPeriod,
  limit: number = 10,
): Promise<readonly Article[]> {
  const now = new Date();

  // Fetch a large pool so minority platforms are represented after diversity filtering.
  let query = supabase
    .from("articles")
    .select("*")
    .gte("engagement_score", 0.1)
    .order("engagement_score", { ascending: false })
    .limit(Math.max(limit * 10, 2000));

  if (period !== "all") {
    const since = new Date(now.getTime() - PERIOD_MS[period]);
    query = query.gte("published_at", since.toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch digest: ${error.message}`);

  const rawArticles = (data ?? []) as Article[];

  // Remove near-duplicates before ranking
  const articles = deduplicateFeed(rawArticles) as Article[];

  // Re-rank by combined recency + popularity
  const nowMs = now.getTime();
  const halfLife = PERIOD_HALF_LIFE[period];
  const ranked = articles.map((article) => {
    const engagement = Number(article.engagement_score) || 0;
    const ageHours = article.published_at
      ? (nowMs - new Date(article.published_at).getTime()) / 3_600_000
      : 720;
    const recency = Math.exp((-0.693 * ageHours) / halfLife);
    const popularity = Math.log2(Math.max(engagement, 0.1) + 1) / 10;
    const hotness = recency * 50 + Math.min(popularity * 50, 50);
    // Factor in personalized relevance when available (60/40 weighting)
    const relevance = article.relevance_score ?? hotness;
    const combinedScore = relevance * 0.6 + hotness * 0.4;
    return { article, combinedScore };
  });

  ranked.sort((a, b) => b.combinedScore - a.combinedScore);

  // Enforce platform diversity: no single platform dominates the digest
  const rankedArticles = ranked.map(({ article }) => article);
  return diversifyByPlatform(rankedArticles, limit);
}

export interface DigestBySourceGroup {
  readonly platform: string;
  readonly label: string;
  readonly articles: readonly Article[];
}

export async function getDigestBySource(
  period: "daily" | "weekly" | "monthly" | "yearly" | "all",
  perSourceLimit: number = 10,
): Promise<readonly DigestBySourceGroup[]> {
  const now = new Date();
  const periodMs: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly: 365 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMs[period];
  const since = ms ? new Date(now.getTime() - ms) : null;

  // Fetch a large pool of high-engagement articles
  let query = supabase
    .from("articles")
    .select("*")
    .gte("engagement_score", 0.3)
    .order("engagement_score", { ascending: false })
    .limit(2000);

  if (since) {
    query = query.gte("published_at", since.toISOString());
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch digest by source: ${error.message}`);

  const rawArticles = (data ?? []) as Article[];
  const articles = deduplicateFeed(rawArticles) as Article[];

  // Group by platform
  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    const list = groups.get(article.platform);
    if (list) {
      list.push(article);
    } else {
      groups.set(article.platform, [article]);
    }
  }

  // Build result: sorted by article count descending, each group capped at perSourceLimit
  const platformOrder = [
    "hackernews",
    "reddit",
    "arxiv",
    "github",
    "huggingface",
    "youtube",
    "blog",
    "newsletter",
    "semantic_scholar",
    "papers_with_code",
  ];

  const result: DigestBySourceGroup[] = [];

  // Add platforms in preferred order first
  for (const platform of platformOrder) {
    const items = groups.get(platform);
    if (items && items.length > 0) {
      result.push({
        platform,
        label: platform,
        articles: items.slice(0, perSourceLimit),
      });
      groups.delete(platform);
    }
  }

  // Add any remaining platforms not in the preferred order
  for (const [platform, items] of groups) {
    if (items.length > 0) {
      result.push({
        platform,
        label: platform,
        articles: items.slice(0, perSourceLimit),
      });
    }
  }

  return result;
}

export async function batchCreateArticles(
  articles: ReadonlyArray<
    Omit<Article, "id" | "created_at" | "fetched_at" | "is_read" | "is_saved">
  >,
): Promise<readonly Article[]> {
  if (articles.length === 0) return [];

  const { data, error } = await supabase
    .from("articles")
    .upsert([...articles], { onConflict: "url", ignoreDuplicates: true })
    .select();

  if (error) throw new Error(`Failed to batch create articles: ${error.message}`);
  return (data ?? []) as Article[];
}
