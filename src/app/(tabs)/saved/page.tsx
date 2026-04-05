"use client";

import { useSavedArticles } from "@/lib/hooks/use-saved-articles";
import { useRateArticle, useToggleSave } from "@/lib/hooks/use-article-mutations";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { ArticleCard } from "@/components/feed/article-card";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";
import { IconBookmark } from "@/components/ui/icon";

export default function SavedPage() {
  const { articles, isLoading, error } = useSavedArticles();
  const { getRating, optimisticRate } = usePreferences();
  const rateMutation = useRateArticle();
  const saveMutation = useToggleSave();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-lg font-bold text-zinc-100">Saved Articles</h1>
        <p className="text-xs text-muted mt-0.5">
          {articles.length > 0
            ? `${articles.length} saved article${articles.length === 1 ? "" : "s"}`
            : "Articles you bookmark will appear here"}
        </p>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="px-4">
          <FeedSkeleton />
        </div>
      )}

      {error && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!isLoading && !error && articles.length === 0 && (
        <div className="px-4 py-16 text-center">
          <IconBookmark className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No saved articles yet</p>
          <p className="text-xs text-muted mt-1">
            Tap the bookmark icon on any article to save it for later.
          </p>
        </div>
      )}

      {!isLoading && !error && articles.length > 0 && (
        <div className="px-4 space-y-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              currentRating={getRating(article.id)}
              onRate={(id, rating) => {
                optimisticRate(id, rating);
                rateMutation.mutate({ id, rating });
              }}
              onToggleSave={(id) => saveMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
