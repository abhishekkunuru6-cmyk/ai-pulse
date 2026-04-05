import type { ApiResponse, Article, Source, DashboardStats, TopicCluster } from "@/types";
import type { DigestPeriod } from "@/lib/schemas";
import {
  fetchArticles,
  fetchArticleById,
  fetchDigest,
  fetchDigestBySource,
  fetchDigestSummary,
  fetchSavedArticles,
  fetchSources,
  fetchStats,
  fetchTopics,
  fetchTopicArticles,
  searchArticles,
  rateArticle,
  toggleArticleSave,
  markArticleAsRead,
} from "@/lib/api-client";
import type { DigestBySourceGroup, DigestSummary } from "@/lib/api-client";

/**
 * Unwraps an ApiResponse, throwing on failure so React Query
 * can manage errors via its own error state.
 */
function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === null) {
    throw new Error(response.error ?? "Request failed");
  }
  return response.data;
}

/**
 * Same as unwrap but also returns pagination meta.
 */
function unwrapWithMeta<T>(response: ApiResponse<T>) {
  if (!response.success || response.data === null) {
    throw new Error(response.error ?? "Request failed");
  }
  return { data: response.data, meta: response.meta ?? null };
}

// -- Queries --

export async function fetchArticlesPage(
  filters?: Readonly<Record<string, string>>,
  signal?: AbortSignal,
) {
  const response = await fetchArticles(filters, signal);
  return unwrapWithMeta(response);
}

export async function fetchSingleArticle(id: string, signal?: AbortSignal): Promise<Article> {
  const response = await fetchArticleById(id, signal);
  return unwrap(response);
}

export async function fetchDigestArticles(
  period: DigestPeriod,
  limit?: number,
  signal?: AbortSignal,
): Promise<readonly Article[]> {
  const response = await fetchDigest(period, limit, signal);
  return unwrap(response);
}

export async function fetchDigestSummaryData(
  period: DigestPeriod,
  signal?: AbortSignal,
): Promise<DigestSummary> {
  const response = await fetchDigestSummary(period, signal);
  return unwrap(response);
}

export async function fetchDigestBySourceGroups(
  period: DigestPeriod,
  perSource: number,
  signal?: AbortSignal,
): Promise<readonly DigestBySourceGroup[]> {
  const response = await fetchDigestBySource(period, perSource, signal);
  return unwrap(response);
}

export async function fetchAllSources(signal?: AbortSignal): Promise<readonly Source[]> {
  const response = await fetchSources(signal);
  return unwrap(response);
}

export async function fetchDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
  const response = await fetchStats(signal);
  return unwrap(response);
}

export async function fetchSearchResults(
  query: string,
  signal?: AbortSignal,
): Promise<readonly Article[]> {
  const response = await searchArticles(query, undefined, signal);
  return unwrap(response);
}

export async function fetchTopicClusters(
  timeRange: string,
  signal?: AbortSignal,
): Promise<readonly TopicCluster[]> {
  const response = await fetchTopics(timeRange, signal);
  return unwrap(response);
}

export async function fetchTopicDetail(
  slug: string,
  articleIds: readonly string[],
  signal?: AbortSignal,
): Promise<readonly Article[]> {
  const response = await fetchTopicArticles(slug, articleIds, signal);
  return unwrap(response).articles;
}

export async function fetchSavedArticlesData(signal?: AbortSignal): Promise<readonly Article[]> {
  const response = await fetchSavedArticles(signal);
  return unwrap(response);
}

// -- Mutations --

export async function mutateRateArticle(params: {
  id: string;
  rating: "up" | "down" | "none";
}): Promise<Article> {
  const response = await rateArticle(params.id, params.rating);
  return unwrap(response);
}

export async function mutateToggleSave(id: string): Promise<Article> {
  const response = await toggleArticleSave(id);
  return unwrap(response);
}

export async function mutateMarkAsRead(id: string): Promise<Article> {
  const response = await markArticleAsRead(id);
  return unwrap(response);
}
