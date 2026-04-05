"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchDigestBySourceGroups } from "@/lib/query/fetchers";
import type { DigestBySourceGroup } from "@/lib/api-client";
import type { DigestPeriod } from "@/lib/schemas";

export function useDigestBySource(period: DigestPeriod, perSource: number = 10) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.digest.bySource(period, perSource),
    queryFn: ({ signal }) => fetchDigestBySourceGroups(period, perSource, signal),
  });

  return {
    groups: (data ?? []) as readonly DigestBySourceGroup[],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
