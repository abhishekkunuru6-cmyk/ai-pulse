"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchSingleArticle } from "@/lib/query/fetchers";

export function useArticle(id: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.articles.detail(id),
    queryFn: ({ signal }) => fetchSingleArticle(id, signal),
  });

  return {
    article: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
