"use client";

import { useEffect, useRef } from "react";
import type { Article } from "@/types";
import { ArticleCard } from "./article-card";
import { FeedSkeleton, ArticleCardSkeleton } from "@/components/ui/loading-skeleton";

interface ArticleListProps {
  readonly articles: readonly Article[];
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly hasMore: boolean;
  readonly error: string | null;
  readonly onLoadMore: () => void;
  readonly onRate: (id: string, rating: "up" | "down" | "none") => void;
  readonly onToggleSave: (id: string) => void;
  readonly onDismiss?: (id: string) => void;
  readonly getRating?: (id: string) => "up" | "down" | null;
}

export function ArticleList({
  articles,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onRate,
  onToggleSave,
  onDismiss,
  getRating,
}: ArticleListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (isLoading) {
    return (
      <div className="px-4">
        <FeedSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <p className="text-xs text-muted mt-1">Please check your connection and try again.</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-zinc-400">No articles found</p>
        <p className="text-xs text-muted mt-1">Try adjusting your filters or check back later.</p>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          currentRating={getRating?.(article.id)}
          onRate={onRate}
          onToggleSave={onToggleSave}
          onDismiss={onDismiss}
        />
      ))}

      {/* Loading more indicator */}
      {isLoadingMore && <ArticleCardSkeleton />}

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-4" />}

      {/* End of feed */}
      {!hasMore && articles.length > 0 && (
        <p className="text-center text-xs text-muted py-4">You&apos;ve reached the end</p>
      )}
    </div>
  );
}
