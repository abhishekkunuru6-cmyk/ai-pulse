"use client";

import { useMemo, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Article } from "@/types";
import type { PaginationMeta } from "@/types/api";
import { queryKeys } from "@/lib/query/keys";
import { fetchArticlesPage } from "@/lib/query/fetchers";

interface ArticlesPage {
  readonly data: Article[];
  readonly meta: PaginationMeta | null;
}

export function useArticles(filters?: Readonly<Record<string, string>>) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, error, fetchNextPage, refetch } =
    useInfiniteQuery<
      ArticlesPage,
      Error,
      { pages: ArticlesPage[]; pageParams: (string | undefined)[] },
      ReturnType<typeof queryKeys.articles.list>,
      string | undefined
    >({
      queryKey: queryKeys.articles.list(filters),
      queryFn: ({ pageParam, signal }) => {
        const params: Record<string, string> = { ...filters };
        if (pageParam) {
          params.cursor = pageParam;
        }
        return fetchArticlesPage(Object.keys(params).length > 0 ? params : undefined, signal);
      },
      initialPageParam: undefined,
      getNextPageParam: (lastPage) =>
        lastPage.meta?.has_more ? (lastPage.meta.cursor ?? undefined) : undefined,
    });

  const articles = useMemo<readonly Article[]>(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    articles,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage ?? false,
    error: error ? error.message : null,
    loadMore,
    refresh: () => {
      refetch();
    },
  };
}
