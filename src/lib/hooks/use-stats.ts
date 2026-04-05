"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/types";
import { queryKeys } from "@/lib/query/keys";
import { fetchDashboardStats } from "@/lib/query/fetchers";

export type { DashboardStats };

function isValidStats(data: unknown): data is DashboardStats {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.total_articles === "number" &&
    typeof obj.total_sources === "number" &&
    typeof obj.articles_today === "number" &&
    typeof obj.unread_count === "number" &&
    typeof obj.saved_count === "number" &&
    obj.sources_by_status !== null &&
    typeof obj.sources_by_status === "object" &&
    obj.sources_by_category !== null &&
    typeof obj.sources_by_category === "object"
  );
}

export function useStats() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: async ({ signal }) => {
      const raw = await fetchDashboardStats(signal);
      if (!isValidStats(raw)) {
        throw new Error("Unexpected response format from stats API");
      }
      return raw;
    },
  });

  return {
    stats: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
