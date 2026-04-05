"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Article } from "@/types";
import { queryKeys } from "@/lib/query/keys";
import { mutateRateArticle, mutateToggleSave, mutateMarkAsRead } from "@/lib/query/fetchers";

export function useRateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutateRateArticle,
    onSuccess: (_result, variables) => {
      // Invalidate preferences cache so the rating UI updates
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      // Also invalidate article lists (rating may affect future ordering)
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useToggleSave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutateToggleSave,
    onSuccess: (updatedArticle) => {
      // Update the single article cache
      queryClient.setQueryData<Article>(
        queryKeys.articles.detail(updatedArticle.id),
        updatedArticle,
      );
      // Invalidate lists (saved filter may change results) and stats (saved_count)
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutateMarkAsRead,
    onSuccess: (updatedArticle) => {
      queryClient.setQueryData<Article>(
        queryKeys.articles.detail(updatedArticle.id),
        updatedArticle,
      );
      // Invalidate lists (read filter) and stats (unread_count)
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
