"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchSearchResults } from "@/lib/query/fetchers";

export function useSearchArticles(query: string) {
  const trimmed = query.trim();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.articles.search(trimmed),
    queryFn: ({ signal }) => fetchSearchResults(trimmed, signal),
    enabled: trimmed.length > 0,
  });

  return {
    results: data ?? [],
    isLoading,
    hasSearched: trimmed.length > 0,
    error: error ? (error as Error).message : null,
  };
}
