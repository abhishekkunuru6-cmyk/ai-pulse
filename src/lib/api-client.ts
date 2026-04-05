import type { ApiResponse, Article, Source, DashboardStats } from "@/types";
import type { DigestPeriod } from "@/lib/schemas";

/**
 * Internal fetch wrapper that handles JSON parsing and error extraction.
 * Returns a typed ApiResponse for all calls.
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      ...options,
    });

    const body: ApiResponse<T> = await response.json();

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: body.error ?? `Request failed with status ${response.status}`,
      };
    }

    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, data: null, error: "Request was cancelled" };
    }
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, data: null, error: message };
  }
}

/**
 * Builds a query string from a record of string key-value pairs.
 * Omits entries with empty values.
 */
function buildQueryString(params: Readonly<Record<string, string | undefined>>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function fetchArticles(
  filters?: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<ApiResponse<Article[]>> {
  const query = filters ? buildQueryString(filters) : "";
  return apiFetch<Article[]>(`/api/articles${query}`, { signal });
}

export function fetchArticleById(id: string, signal?: AbortSignal): Promise<ApiResponse<Article>> {
  return apiFetch<Article>(`/api/articles/${id}`, { signal });
}

export function markArticleAsRead(id: string): Promise<ApiResponse<Article>> {
  return apiFetch<Article>(`/api/articles/${id}/read`, {
    method: "POST",
  });
}

export function toggleArticleSave(id: string): Promise<ApiResponse<Article>> {
  return apiFetch<Article>(`/api/articles/${id}/save`, {
    method: "POST",
  });
}

export function rateArticle(
  id: string,
  rating: "up" | "down" | "none",
): Promise<ApiResponse<Article>> {
  return apiFetch<Article>(`/api/articles/${id}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

export function searchArticles(
  query: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<ApiResponse<Article[]>> {
  const params = buildQueryString({ q: query, cursor });
  return apiFetch<Article[]>(`/api/articles/search${params}`, { signal });
}

export function fetchSavedArticles(signal?: AbortSignal): Promise<ApiResponse<Article[]>> {
  return apiFetch<Article[]>("/api/articles/saved", { signal });
}

export function fetchSources(signal?: AbortSignal): Promise<ApiResponse<Source[]>> {
  return apiFetch<Source[]>("/api/sources", { signal });
}

export function fetchStats(signal?: AbortSignal): Promise<ApiResponse<DashboardStats>> {
  return apiFetch<DashboardStats>("/api/stats", { signal });
}

export function fetchTopics(
  timeRange?: string,
  signal?: AbortSignal,
): Promise<ApiResponse<import("@/types").TopicCluster[]>> {
  const params = buildQueryString({ time_range: timeRange, limit: "30" });
  return apiFetch(`/api/topics${params}`, { signal });
}

export function fetchTopicArticles(
  slug: string,
  articleIds: readonly string[],
  signal?: AbortSignal,
): Promise<ApiResponse<{ articles: import("@/types/database").Article[] }>> {
  const params = buildQueryString({ ids: articleIds.join(",") });
  return apiFetch(`/api/topics/${slug}${params}`, { signal });
}

export function fetchDigest(
  period?: DigestPeriod,
  limit?: number,
  signal?: AbortSignal,
): Promise<ApiResponse<Article[]>> {
  const params = buildQueryString({
    period,
    limit: limit ? String(limit) : undefined,
  });
  return apiFetch<Article[]>(`/api/digest${params}`, { signal });
}

export interface DigestBySourceGroup {
  readonly platform: string;
  readonly label: string;
  readonly articles: readonly Article[];
}

export function fetchDigestBySource(
  period: DigestPeriod,
  perSource: number = 10,
  signal?: AbortSignal,
): Promise<ApiResponse<DigestBySourceGroup[]>> {
  const params = buildQueryString({ period, per_source: String(perSource) });
  return apiFetch<DigestBySourceGroup[]>(`/api/digest/by-source${params}`, { signal });
}

export interface DigestSummary {
  readonly summary: string;
  readonly articleCount: number;
  readonly period: string;
}

export function fetchDigestSummary(
  period: DigestPeriod,
  signal?: AbortSignal,
): Promise<ApiResponse<DigestSummary>> {
  const params = buildQueryString({ period });
  return apiFetch<DigestSummary>(`/api/digest/summary${params}`, { signal });
}
