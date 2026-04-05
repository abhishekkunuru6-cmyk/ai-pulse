"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchDigestSummaryData } from "@/lib/query/fetchers";
import type { DigestSummary } from "@/lib/api-client";
import type { DigestPeriod } from "@/lib/schemas";

export function useDigestSummary(period: DigestPeriod, enabled: boolean = true) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.digest.summary(period),
    queryFn: ({ signal }) => fetchDigestSummaryData(period, signal),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to avoid re-calling Gemini
    gcTime: 10 * 60 * 1000,
  });

  return {
    summary: data as DigestSummary | undefined,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
