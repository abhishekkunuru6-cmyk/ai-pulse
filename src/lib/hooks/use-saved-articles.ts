"use client";

import { useQuery } from "@tanstack/react-query";
import type { Article } from "@/types";
import { queryKeys } from "@/lib/query/keys";
import { fetchSavedArticlesData } from "@/lib/query/fetchers";

export function useSavedArticles() {
  const { data, isLoading, error, refetch } = useQuery<readonly Article[], Error>({
    queryKey: queryKeys.articles.saved(),
    queryFn: ({ signal }) => fetchSavedArticlesData(signal),
  });

  return {
    articles: data ?? [],
    isLoading,
    error: error ? error.message : null,
    refresh: refetch,
  };
}
