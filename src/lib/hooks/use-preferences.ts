"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArticlePreference, Rating } from "@/types";

const PREFERENCES_KEY = ["preferences"] as const;

async function fetchPreferences(): Promise<readonly ArticlePreference[]> {
  const response = await fetch("/api/preferences");
  const body = await response.json();
  if (!body.success) throw new Error(body.error ?? "Failed to fetch preferences");
  return body.data;
}

/**
 * Provides a map of article_id -> rating for all user preferences.
 * Also exposes an optimistic update method for instant UI feedback.
 */
export function usePreferences() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<readonly ArticlePreference[]>({
    queryKey: PREFERENCES_KEY,
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const ratingMap = useMemo(() => {
    const map = new Map<string, Rating>();
    for (const pref of data ?? []) {
      map.set(pref.article_id, pref.rating);
    }
    return map;
  }, [data]);

  const getRating = useCallback(
    (articleId: string): Rating | null => ratingMap.get(articleId) ?? null,
    [ratingMap],
  );

  /** Optimistically update the rating in the local cache for instant UI feedback.
   *  If rating is "none", removes the preference entirely. */
  const optimisticRate = useCallback(
    (articleId: string, rating: Rating | "none") => {
      queryClient.setQueryData<readonly ArticlePreference[]>(PREFERENCES_KEY, (old) => {
        const existing = old ?? [];
        const filtered = existing.filter((p) => p.article_id !== articleId);
        if (rating === "none") return filtered;
        return [
          ...filtered,
          { id: articleId, article_id: articleId, rating, created_at: new Date().toISOString() },
        ];
      });
    },
    [queryClient],
  );

  return { getRating, optimisticRate, isLoading };
}
