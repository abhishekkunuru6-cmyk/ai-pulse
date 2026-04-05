"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { useTopicDetail } from "@/lib/hooks/use-topics";
import { useRateArticle, useToggleSave } from "@/lib/hooks/use-article-mutations";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useSettingsFilter } from "@/lib/hooks/use-settings-filter";
import { formatDate, formatDateRange } from "@/lib/utils/format-time";
import { CONTENT_TYPE_META } from "@/lib/utils/content-type-meta";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import {
  IconChevronLeft,
  IconExternalLink,
  IconClock,
  IconThumbsUp,
  IconThumbsDown,
  IconBookmark,
  IconStar,
} from "@/components/ui/icon";
import { formatCompactNumber } from "@/lib/utils/format-number";
import { PlatformBadge } from "@/components/feed/article-card-badge";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";
import type { Article, ContentType, Platform } from "@/types";

interface TopicDetailPageProps {
  readonly params: Promise<{ slug: string }>;
}

export default function TopicDetailPage({ params }: TopicDetailPageProps) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const timeRange = searchParams.get("t") ?? "week";
  const {
    cluster,
    label,
    articles: rawArticles,
    summary,
    isLoading,
    error,
  } = useTopicDetail(slug, timeRange);
  const { getRating, optimisticRate } = usePreferences();
  const rateMutation = useRateArticle();
  const saveMutation = useToggleSave();
  const { filterArticles } = useSettingsFilter();

  // Apply settings-based filtering
  const articles = useMemo(() => filterArticles(rawArticles), [rawArticles, filterArticles]);

  const [activePlatforms, setActivePlatforms] = useState<ReadonlySet<Platform>>(new Set());
  const [activeContentTypes, setActiveContentTypes] = useState<ReadonlySet<ContentType>>(new Set());

  // Derive available platforms and content types from articles
  const { availablePlatforms, availableContentTypes } = useMemo(() => {
    const platforms = new Map<Platform, number>();
    const contentTypes = new Map<ContentType, number>();

    for (const article of articles) {
      platforms.set(article.platform, (platforms.get(article.platform) ?? 0) + 1);
      contentTypes.set(article.content_type, (contentTypes.get(article.content_type) ?? 0) + 1);
    }

    return {
      availablePlatforms: [...platforms.entries()].sort((a, b) => b[1] - a[1]),
      availableContentTypes: [...contentTypes.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [articles]);

  // Filter articles based on active filters
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (activePlatforms.size > 0 && !activePlatforms.has(article.platform)) return false;
      if (activeContentTypes.size > 0 && !activeContentTypes.has(article.content_type))
        return false;
      return true;
    });
  }, [articles, activePlatforms, activeContentTypes]);

  const activeFilterCount = activePlatforms.size + activeContentTypes.size;

  function togglePlatform(platform: Platform) {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  function toggleContentType(contentType: ContentType) {
    setActiveContentTypes((prev) => {
      const next = new Set(prev);
      if (next.has(contentType)) {
        next.delete(contentType);
      } else {
        next.add(contentType);
      }
      return next;
    });
  }

  function clearFilters() {
    setActivePlatforms(new Set());
    setActiveContentTypes(new Set());
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-0 px-4 py-4">
        <FeedSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 px-4 py-12 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/" className="text-xs text-brand-400 mt-2 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const grouped = groupByContentType(filteredArticles);

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="px-4 py-4 space-y-4">
        {/* Back button */}
        <Link href="/" className="flex items-center gap-1 text-muted text-sm -ml-1">
          <IconChevronLeft className="w-5 h-5" />
          Back to feed
        </Link>

        {/* Topic header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-zinc-100">{label}</h1>
            {cluster && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">
                  Hotness {cluster.hotness_score}
                </span>
                <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">
                  Relevance {cluster.relevance_score}
                </span>
              </div>
            )}
          </div>

          {/* Summary */}
          {summary && <p className="text-xs text-zinc-400 leading-relaxed">{summary}</p>}

          {/* Meta row: article count, date range, platforms */}
          <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
            <span>
              {filteredArticles.length} of {articles.length}{" "}
              {articles.length === 1 ? "article" : "articles"}
              {activeFilterCount > 0 && " (filtered)"}
            </span>
            {cluster?.oldest_date && (
              <span className="flex items-center gap-1">
                <IconClock className="w-3 h-3" />
                {formatDateRange(cluster.oldest_date, cluster.latest_date)}
              </span>
            )}
            {cluster?.content_types.map((type) => {
              const meta = CONTENT_TYPE_META[type];
              return (
                <span
                  key={type}
                  className={`font-medium px-1.5 py-0.5 rounded-full ${meta.colorClass} ${meta.bgClass}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Source filter chips */}
        {availablePlatforms.length > 1 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Source
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availablePlatforms.map(([platform, count]) => {
                const meta = PLATFORM_META[platform];
                const isActive = activePlatforms.has(platform);
                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors",
                      isActive
                        ? `${meta.bgClass} ${meta.colorClass} border-current font-medium`
                        : "bg-surface-2 text-zinc-400 border-zinc-800 hover:border-zinc-600",
                    )}
                  >
                    <PlatformBadge platform={platform} />
                    {meta.label}
                    <span
                      className={clsx("text-[10px]", isActive ? "opacity-80" : "text-zinc-500")}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content type filter chips */}
        {availableContentTypes.length > 1 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {availableContentTypes.map(([contentType, count]) => {
                const meta = CONTENT_TYPE_META[contentType];
                const isActive = activeContentTypes.has(contentType);
                return (
                  <button
                    key={contentType}
                    onClick={() => toggleContentType(contentType)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors",
                      isActive
                        ? `${meta.bgClass} ${meta.colorClass} border-current font-medium`
                        : "bg-surface-2 text-zinc-400 border-zinc-800 hover:border-zinc-600",
                    )}
                  >
                    {meta.label}
                    <span
                      className={clsx("text-[10px]", isActive ? "opacity-80" : "text-zinc-500")}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            Clear all filters
          </button>
        )}

        {/* Grouped sections */}
        {grouped.map(({ type, items }) => (
          <section key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${CONTENT_TYPE_META[type].colorClass}`}
              >
                {CONTENT_TYPE_META[type].label}s
              </span>
              <span className="text-[10px] text-muted">({items.length})</span>
            </div>

            <div className="space-y-2">
              {items.map((article) => (
                <TopicArticleCard
                  key={article.id}
                  article={article}
                  currentRating={getRating(article.id)}
                  onRate={(rating) => {
                    optimisticRate(article.id, rating);
                    rateMutation.mutate({ id: article.id, rating });
                  }}
                  onToggleSave={() => saveMutation.mutate(article.id)}
                />
              ))}
            </div>
          </section>
        ))}

        {filteredArticles.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-400">
              {activeFilterCount > 0
                ? "No articles match the selected filters"
                : "No articles found for this topic"}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-brand-400 mt-2">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getEngagementLabel(article: Article): string | null {
  const metrics = article.engagement_metrics;

  if (article.platform === "github") {
    const stars = Number(metrics?.stars ?? 0);
    if (stars > 0) return `${formatCompactNumber(stars)} stars`;
    const forks = Number(metrics?.forks ?? 0);
    if (forks > 0) return `${formatCompactNumber(forks)} forks`;
  }
  if (article.platform === "hackernews") {
    const points = Number(metrics?.points ?? 0);
    if (points > 0) return `${formatCompactNumber(points)} points`;
  }
  if (article.platform === "reddit") {
    const upvotes = Number(metrics?.upvotes ?? 0);
    if (upvotes > 0) return `${formatCompactNumber(upvotes)} upvotes`;
  }
  if (article.platform === "arxiv") {
    const citations = Number(metrics?.citations ?? 0);
    if (citations > 0) return `${formatCompactNumber(citations)} citations`;
    const influential = Number(metrics?.influential_citations ?? 0);
    if (influential > 0) return `${formatCompactNumber(influential)} influential`;
  }
  if (article.platform === "huggingface") {
    const upvotes = Number(metrics?.upvotes ?? 0);
    if (upvotes > 0) return `${formatCompactNumber(upvotes)} upvotes`;
  }

  const score = Number(article.engagement_score) || 0;
  if (score > 0) return `${score.toFixed(1)} score`;
  return null;
}

function TopicArticleCard({
  article,
  currentRating,
  onRate,
  onToggleSave,
}: {
  readonly article: Article;
  readonly currentRating?: "up" | "down" | null;
  readonly onRate: (rating: "up" | "down" | "none") => void;
  readonly onToggleSave: () => void;
}) {
  const platformMeta = PLATFORM_META[article.platform];
  const engagementLabel = getEngagementLabel(article);
  const isLiked = currentRating === "up";
  const isDisliked = currentRating === "down";
  const [isSavedOptimistic, setIsSavedOptimistic] = useState(article.is_saved);
  useEffect(() => {
    setIsSavedOptimistic(article.is_saved);
  }, [article.is_saved]);

  return (
    <div className="bg-surface-1 rounded-xl border border-zinc-800/60 p-3 space-y-2">
      {/* Date + platform + engagement row */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-200 font-semibold px-2 py-0.5 rounded-md">
          <IconClock className="w-3 h-3 text-zinc-400" />
          {formatDate(article.published_at)}
        </span>
        <PlatformBadge platform={article.platform} />
        <span className="text-zinc-400">{platformMeta.label}</span>
        {engagementLabel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-600/15 text-amber-400">
            <IconStar className="w-3 h-3" />
            {engagementLabel}
          </span>
        )}
      </div>

      {/* Title */}
      <Link
        href={`/article/${article.id}`}
        className="text-sm font-medium text-zinc-100 leading-snug block hover:underline"
      >
        {article.title}
      </Link>

      {/* Summary */}
      {article.summary_snippet && (
        <p className="text-xs text-muted leading-relaxed line-clamp-2">{article.summary_snippet}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/40">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 bg-brand-600/10 hover:bg-brand-600/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <IconExternalLink className="w-3.5 h-3.5" />
          Read
        </a>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onRate(isLiked ? "none" : "up")}
            className={clsx(
              "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200",
              isLiked
                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                : "text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10",
            )}
          >
            <IconThumbsUp
              className={clsx("w-3.5 h-3.5", isLiked && "scale-110")}
              fill={isLiked ? "currentColor" : "none"}
            />
            {isLiked && <span className="text-[10px] font-semibold">Liked</span>}
          </button>
          <button
            onClick={() => onRate(isDisliked ? "none" : "down")}
            className={clsx(
              "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200",
              isDisliked
                ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                : "text-zinc-500 hover:text-red-400 hover:bg-red-500/10",
            )}
          >
            <IconThumbsDown
              className={clsx("w-3.5 h-3.5", isDisliked && "scale-110")}
              fill={isDisliked ? "currentColor" : "none"}
            />
            {isDisliked && <span className="text-[10px] font-semibold">Disliked</span>}
          </button>
          <button
            onClick={() => {
              setIsSavedOptimistic((prev) => !prev);
              onToggleSave();
            }}
            className={clsx(
              "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200",
              isSavedOptimistic
                ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10",
            )}
          >
            <IconBookmark
              className={clsx("w-3.5 h-3.5", isSavedOptimistic && "scale-110")}
              fill={isSavedOptimistic ? "currentColor" : "none"}
            />
            {isSavedOptimistic && <span className="text-[10px] font-semibold">Saved</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

function groupByContentType(articles: readonly Article[]) {
  const groups = new Map<string, Article[]>();

  for (const article of articles) {
    const type = article.content_type;
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(article);
  }

  const order = [
    "paper",
    "code",
    "social",
    "news",
    "blog",
    "newsletter",
    "video",
    "podcast",
    "benchmark",
  ];

  return order
    .filter((type) => groups.has(type))
    .map((type) => ({
      type: type as Article["content_type"],
      items: groups.get(type)!,
    }));
}
