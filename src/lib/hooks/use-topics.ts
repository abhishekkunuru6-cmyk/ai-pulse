"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchTopicClusters, fetchTopicDetail } from "@/lib/query/fetchers";
import type { Article, TopicCluster } from "@/types";

/**
 * Clustering is non-deterministic — it depends on DB order, new articles, etc.
 * Keep clusters cached for 5 minutes so that navigating between the topic list
 * and a topic detail page always uses the SAME clustering result.
 * The manual "refresh" button bypasses this via refetch().
 */
const TOPICS_STALE_TIME = 5 * 60 * 1000;

export function useTopics(timeRange: string = "week") {
  const { data, isLoading, error, refetch } = useQuery<readonly TopicCluster[]>({
    queryKey: queryKeys.topics.list(timeRange),
    queryFn: ({ signal }) => fetchTopicClusters(timeRange, signal),
    staleTime: TOPICS_STALE_TIME,
  });

  return {
    topics: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => {
      refetch();
    },
  };
}

/**
 * Fetch a topic's full articles by looking up the cluster from the cached list
 * and fetching the exact article IDs. This guarantees the detail page shows
 * the same articles as the topic card.
 */
export function useTopicDetail(slug: string, timeRange: string = "week") {
  // First: get the cluster list (usually already cached from the main page)
  // Uses the same staleTime so navigating here does NOT trigger a background
  // refetch that would re-run clustering and produce different article sets.
  const { data: clusters, isLoading: clustersLoading } = useQuery<readonly TopicCluster[]>({
    queryKey: queryKeys.topics.list(timeRange),
    queryFn: ({ signal }) => fetchTopicClusters(timeRange, signal),
    staleTime: TOPICS_STALE_TIME,
  });

  // Find the matching cluster from the list
  const cluster = clusters?.find((c) => c.slug === slug) ?? null;
  const articleIds = cluster?.article_ids ?? [];

  // Second: fetch the full articles by their IDs
  // Include articleIds in the query key to bust stale cache when cluster data changes
  const {
    data: articles,
    isLoading: articlesLoading,
    error,
  } = useQuery<readonly Article[]>({
    queryKey: queryKeys.topics.detail(slug, timeRange, articleIds),
    queryFn: ({ signal }) => fetchTopicDetail(slug, articleIds, signal),
    // Only fetch when we have the cluster and its article IDs
    enabled: slug.length > 0 && articleIds.length > 0,
    staleTime: TOPICS_STALE_TIME,
  });

  return {
    cluster,
    label: cluster?.label ?? slug,
    articles: articles ?? cluster?.top_articles ?? [],
    summary: cluster?.summary ?? "",
    isLoading: clustersLoading || articlesLoading,
    error: error ? (error as Error).message : null,
  };
}
