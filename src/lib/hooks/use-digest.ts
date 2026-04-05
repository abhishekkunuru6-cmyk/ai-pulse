"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchDigestArticles } from "@/lib/query/fetchers";
import type { DigestPeriod } from "@/lib/schemas";

export function useDigest(period: DigestPeriod, limit?: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.digest.byPeriod(period, limit),
    queryFn: ({ signal }) => fetchDigestArticles(period, limit, signal),
  });

  return {
    articles: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
