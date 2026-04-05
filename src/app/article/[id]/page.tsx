"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useArticle } from "@/lib/hooks/use-article";
import { useRateArticle, useToggleSave, useMarkAsRead } from "@/lib/hooks/use-article-mutations";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { formatRelativeTime } from "@/lib/utils/format-time";
import { formatCompactNumber } from "@/lib/utils/format-number";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import {
  IconChevronLeft,
  IconExternalLink,
  IconThumbsUp,
  IconThumbsDown,
  IconBookmark,
  IconStar,
} from "@/components/ui/icon";
import { ContentTypeBadge, PlatformBadge } from "@/components/feed/article-card-badge";
import { ArticleCardSkeleton } from "@/components/ui/loading-skeleton";

interface ArticleDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export default function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { id } = use(params);
  const { article, isLoading, error } = useArticle(id);
  const { getRating, optimisticRate } = usePreferences();
  const rateMutation = useRateArticle();
  const saveMutation = useToggleSave();
  const readMutation = useMarkAsRead();
  const [isSavedOptimistic, setIsSavedOptimistic] = useState(false);
  useEffect(() => {
    if (article) setIsSavedOptimistic(article.is_saved);
  }, [article?.is_saved]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-0 px-4 py-4">
        <ArticleCardSkeleton />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-surface-0 px-4 py-12 text-center">
        <p className="text-sm text-red-400">{error ?? "Article not found"}</p>
        <Link href="/" className="text-xs text-brand-400 mt-2 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const platformMeta = PLATFORM_META[article.platform];
  const engagementScore = Number(article.engagement_score) || 0;

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="px-4 py-4 space-y-4">
        {/* Back button */}
        <Link href="/" className="flex items-center gap-1 text-muted text-sm -ml-1">
          <IconChevronLeft className="w-5 h-5" />
          Back to feed
        </Link>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ContentTypeBadge
              contentType={article.content_type}
              isTrending={engagementScore > 100}
            />
            <span className="text-[10px] text-muted">
              {formatRelativeTime(article.published_at)}
            </span>
          </div>
          <h1 className="text-lg font-bold leading-snug text-zinc-100">{article.title}</h1>
        </div>

        {/* Source info card */}
        <div className="bg-surface-2 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={article.platform} />
            <span className="text-sm text-zinc-200">{platformMeta.label}</span>
            <div className="flex gap-0.5 ml-auto">
              <IconStar className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400">4.5</span>
            </div>
          </div>
          {engagementScore > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted">
              <span>{formatCompactNumber(engagementScore)} points</span>
            </div>
          )}
        </div>

        {/* Summary */}
        {article.summary_snippet && (
          <p className="text-sm text-zinc-300 leading-relaxed">{article.summary_snippet}</p>
        )}

        {/* Recommendation reason */}
        {article.recommendation_reason && (
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Why this was recommended
            </h3>
            <p className="text-xs text-zinc-400">{article.recommendation_reason}</p>
          </div>
        )}

        {/* Topics */}
        {article.topic_tags.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Topics
            </h3>
            <div className="flex gap-2 flex-wrap">
              {article.topic_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-surface-2 text-zinc-300 px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => readMutation.mutate(article.id)}
            className="w-full bg-brand-600 text-white text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors"
          >
            <IconExternalLink className="w-4 h-4" />
            Read Article
          </a>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const isLiked = getRating(article.id) === "up";
                const next = isLiked ? "none" : "up";
                optimisticRate(article.id, next);
                rateMutation.mutate({ id: article.id, rating: next });
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
                getRating(article.id) === "up"
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-surface-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <IconThumbsUp
                className="w-4.5 h-4.5"
                fill={getRating(article.id) === "up" ? "currentColor" : "none"}
              />
              <span className="text-xs font-medium">
                {getRating(article.id) === "up" ? "Liked" : "Like"}
              </span>
            </button>
            <button
              onClick={() => {
                const isDisliked = getRating(article.id) === "down";
                const next = isDisliked ? "none" : "down";
                optimisticRate(article.id, next);
                rateMutation.mutate({ id: article.id, rating: next });
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
                getRating(article.id) === "down"
                  ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                  : "bg-surface-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
              }`}
            >
              <IconThumbsDown
                className="w-4.5 h-4.5"
                fill={getRating(article.id) === "down" ? "currentColor" : "none"}
              />
              <span className="text-xs font-medium">
                {getRating(article.id) === "down" ? "Disliked" : "Dislike"}
              </span>
            </button>
            <button
              onClick={() => {
                setIsSavedOptimistic((prev) => !prev);
                saveMutation.mutate(article.id);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
                isSavedOptimistic
                  ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                  : "bg-surface-2 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              <IconBookmark
                className="w-4.5 h-4.5"
                fill={isSavedOptimistic ? "currentColor" : "none"}
              />
              <span className="text-xs font-medium">{isSavedOptimistic ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
