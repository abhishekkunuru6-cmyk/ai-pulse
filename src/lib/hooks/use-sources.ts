"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchAllSources } from "@/lib/query/fetchers";

export function useSources() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.sources.list(),
    queryFn: ({ signal }) => fetchAllSources(signal),
  });

  return {
    sources: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
