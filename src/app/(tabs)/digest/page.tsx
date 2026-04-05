"use client";

import { useMemo, useState } from "react";
import { useDigest } from "@/lib/hooks/use-digest";
import { useDigestBySource } from "@/lib/hooks/use-digest-by-source";
import { useDigestSummary } from "@/lib/hooks/use-digest-summary";
import { useRateArticle, useToggleSave } from "@/lib/hooks/use-article-mutations";
import { useSettings } from "@/lib/hooks/use-settings";
import { useSettingsFilter } from "@/lib/hooks/use-settings-filter";
import { useDismissedArticles } from "@/lib/hooks/use-dismissed-articles";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { ArticleCard } from "@/components/feed/article-card";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";
import { Chip } from "@/components/ui/chip";
import { IconRefresh } from "@/components/ui/icon";
import { CONTENT_TYPE_META } from "@/lib/utils/content-type-meta";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import type { ContentType, Platform } from "@/types";

type DigestPeriod = "daily" | "weekly" | "monthly" | "yearly" | "all";
type ViewMode = "overall" | "by-source";

export default function DigestPage() {
  const [period, setPeriod] = useState<DigestPeriod>("daily");
  const [viewMode, setViewMode] = useState<ViewMode>("overall");
  const { settings, updateSettings } = useSettings();
  const {
    articles: rawArticles,
    isLoading,
    error,
    refetch,
  } = useDigest(period, settings.digestArticleCount);
  const {
    groups: rawGroups,
    isLoading: isLoadingBySource,
    error: errorBySource,
    refetch: refetchBySource,
  } = useDigestBySource(period);
  const [showSummary, setShowSummary] = useState(false);
  const {
    summary: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useDigestSummary(period, showSummary);
  const { getRating, optimisticRate } = usePreferences();
  const rateMutation = useRateArticle();
  const saveMutation = useToggleSave();
  const { dismiss, isDismissed } = useDismissedArticles();
  const { filterArticlesForDigest, filterDigestGroups } = useSettingsFilter();

  // Apply settings-based filtering + dismiss filtering
  const articles = useMemo(
    () => filterArticlesForDigest(rawArticles).filter((a) => !isDismissed(a.id)),
    [rawArticles, filterArticlesForDigest, isDismissed],
  );
  const groups = useMemo(() => filterDigestGroups(rawGroups), [rawGroups, filterDigestGroups]);

  // Active source tab for "By Source" view — null means first group
  const [activeSourceTab, setActiveSourceTab] = useState<string | null>(null);

  // Resolve the selected group
  const selectedGroup = useMemo(() => {
    if (groups.length === 0) return null;
    return groups.find((g) => g.platform === activeSourceTab) ?? groups[0];
  }, [groups, activeSourceTab]);

  // Filters
  const [activeContentTypes, setActiveContentTypes] = useState<ReadonlySet<ContentType>>(new Set());
  const [activePlatforms, setActivePlatforms] = useState<ReadonlySet<Platform>>(new Set());

  // Derive available content types and platforms from current articles
  const availableContentTypes = useMemo(() => {
    const types = new Map<ContentType, number>();
    for (const a of articles) {
      types.set(a.content_type, (types.get(a.content_type) ?? 0) + 1);
    }
    return types;
  }, [articles]);

  const availablePlatforms = useMemo(() => {
    const platforms = new Map<Platform, number>();
    for (const a of articles) {
      platforms.set(a.platform, (platforms.get(a.platform) ?? 0) + 1);
    }
    return platforms;
  }, [articles]);

  // Apply filters
  const filteredArticles = useMemo(() => {
    let filtered = articles;
    if (activeContentTypes.size > 0) {
      filtered = filtered.filter((a) => activeContentTypes.has(a.content_type));
    }
    if (activePlatforms.size > 0) {
      filtered = filtered.filter((a) => activePlatforms.has(a.platform));
    }
    return filtered;
  }, [articles, activeContentTypes, activePlatforms]);

  const toggleContentType = (type: ContentType) => {
    setActiveContentTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const togglePlatform = (platform: Platform) => {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const hasFilters = activeContentTypes.size > 0 || activePlatforms.size > 0;

  const clearFilters = () => {
    setActiveContentTypes(new Set());
    setActivePlatforms(new Set());
  };

  const digestTitles: Record<DigestPeriod, string> = {
    daily: "Today's Top Stories",
    weekly: "This Week's Highlights",
    monthly: "This Month's Best",
    yearly: "This Year's Top Stories",
    all: "All-Time Best",
  };
  const digestSubtitles: Record<DigestPeriod, string> = {
    daily: "The most important AI developments in the last 24 hours",
    weekly: "Top stories from the past 7 days",
    monthly: "Highlights from the past 30 days",
    yearly: "The best stories from the past year",
    all: "The highest-ranked stories of all time",
  };
  const digestTitle = digestTitles[period];
  const digestSubtitle = digestSubtitles[period];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-zinc-100">Digest</h2>
          <button
            onClick={() => {
              refetch();
              refetchBySource();
            }}
            className="p-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
            aria-label="Refresh digest"
          >
            <IconRefresh className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted">{digestSubtitle}</p>
      </div>

      {/* Period toggle + View mode toggle */}
      <div className="flex items-center gap-4 px-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {(
            [
              { value: "daily", label: "24h" },
              { value: "weekly", label: "7d" },
              { value: "monthly", label: "30d" },
              { value: "yearly", label: "1y" },
              { value: "all", label: "All" },
            ] as const
          ).map(({ value, label }) => (
            <Chip
              key={value}
              variant={period === value ? "selected" : "default"}
              onClick={() => setPeriod(value)}
            >
              {label}
            </Chip>
          ))}
        </div>

        <div className="ml-auto flex gap-1 rounded-lg bg-surface-2 p-0.5">
          <button
            onClick={() => setViewMode("overall")}
            className={`text-[11px] px-2.5 py-1 rounded-md transition-colors font-medium ${
              viewMode === "overall"
                ? "bg-brand-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setViewMode("by-source")}
            className={`text-[11px] px-2.5 py-1 rounded-md transition-colors font-medium ${
              viewMode === "by-source"
                ? "bg-brand-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            By Source
          </button>
        </div>
      </div>

      {/* Article count selector */}
      {viewMode === "overall" && (
        <div className="flex items-center gap-2 px-4">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            Articles:
          </span>
          {([15, 25, 50] as const).map((count) => (
            <button
              key={count}
              onClick={() => updateSettings({ digestArticleCount: count })}
              className={`text-[11px] px-2 py-1 rounded-md transition-colors font-medium ${
                settings.digestArticleCount === count
                  ? "bg-brand-600 text-white"
                  : "bg-surface-2 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      )}

      {/* AI Summary */}
      <div className="px-4">
        {!showSummary && (
          <button
            onClick={() => setShowSummary(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors"
          >
            <svg
              className="w-4 h-4 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
            <span className="text-xs font-medium text-purple-300">Generate AI Summary</span>
          </button>
        )}

        {showSummary && isSummaryLoading && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-purple-500/30 animate-pulse" />
              <span className="text-xs font-semibold text-purple-300">
                AI is analyzing recent activity...
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-purple-500/10 rounded animate-pulse w-full" />
              <div className="h-3 bg-purple-500/10 rounded animate-pulse w-5/6" />
              <div className="h-3 bg-purple-500/10 rounded animate-pulse w-4/6" />
              <div className="h-3 bg-purple-500/10 rounded animate-pulse w-full mt-3" />
              <div className="h-3 bg-purple-500/10 rounded animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {showSummary && !isSummaryLoading && summaryError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-red-400">Summary unavailable</span>
              <button
                onClick={() => setShowSummary(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Close summary"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-red-300/70">{summaryError}</p>
          </div>
        )}

        {showSummary && !isSummaryLoading && !summaryError && summaryData && (
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
                <span className="text-xs font-semibold text-purple-300">AI Briefing</span>
                <span className="text-[10px] text-zinc-500">
                  Based on {summaryData.articleCount} articles
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => refetchSummary()}
                  className="p-1 rounded hover:bg-purple-500/10 text-zinc-500 hover:text-purple-300 transition-colors"
                  aria-label="Regenerate summary"
                >
                  <IconRefresh className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowSummary(false)}
                  className="p-1 rounded hover:bg-purple-500/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label="Close summary"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
              {summaryData.summary}
            </div>
          </div>
        )}
      </div>

      {/* === Overall View === */}
      {viewMode === "overall" && (
        <>
          {/* Platform filters */}
          {!isLoading && articles.length > 0 && availablePlatforms.size > 1 && (
            <div className="px-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">
                Platform
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {[...availablePlatforms.entries()].map(([platform, count]) => {
                  const meta = PLATFORM_META[platform];
                  const isActive = activePlatforms.has(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                        isActive
                          ? "bg-brand-600/20 text-brand-400 font-medium"
                          : "bg-surface-2 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {meta?.label ?? platform} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content type filters */}
          {!isLoading && articles.length > 0 && availableContentTypes.size > 1 && (
            <div className="px-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">
                Content Type
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {[...availableContentTypes.entries()].map(([type, count]) => {
                  const meta = CONTENT_TYPE_META[type];
                  const isActive = activeContentTypes.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleContentType(type)}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                        isActive
                          ? `${meta.bgClass} ${meta.colorClass} font-medium`
                          : "bg-surface-2 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {meta.label} ({count})
                    </button>
                  );
                })}
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-[10px] px-2 py-1 text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Overall content */}
          {isLoading && (
            <div className="px-4">
              <FeedSkeleton />
            </div>
          )}

          {!isLoading && error && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <p className="text-xs text-muted mt-1">Please try again later.</p>
            </div>
          )}

          {!isLoading && !error && filteredArticles.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-zinc-400">
                {hasFilters ? "No articles match your filters" : "No articles in this digest yet"}
              </p>
              <p className="text-xs text-muted mt-1">
                {hasFilters
                  ? "Try removing some filters."
                  : "Check back after the next ingestion run."}
              </p>
            </div>
          )}

          {!isLoading && !error && filteredArticles.length > 0 && (
            <div className="px-4 space-y-3">
              <p className="text-xs text-muted font-medium">
                {digestTitle} ({filteredArticles.length} articles)
              </p>
              {filteredArticles.map((article, index) => (
                <div key={article.id} className="relative overflow-visible">
                  <div className="absolute -left-0.5 top-3 z-10 bg-brand-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="pl-5">
                    <ArticleCard
                      article={article}
                      currentRating={getRating(article.id)}
                      onRate={(id, rating) => {
                        optimisticRate(id, rating);
                        rateMutation.mutate({ id, rating });
                      }}
                      onToggleSave={(id) => saveMutation.mutate(id)}
                      onDismiss={dismiss}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === By Source View === */}
      {viewMode === "by-source" && (
        <>
          {isLoadingBySource && (
            <div className="px-4">
              <FeedSkeleton />
            </div>
          )}

          {!isLoadingBySource && errorBySource && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-red-400">{errorBySource}</p>
              <p className="text-xs text-muted mt-1">Please try again later.</p>
            </div>
          )}

          {!isLoadingBySource && !errorBySource && groups.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-zinc-400">No articles in this digest yet</p>
              <p className="text-xs text-muted mt-1">Check back after the next ingestion run.</p>
            </div>
          )}

          {!isLoadingBySource && !errorBySource && groups.length > 0 && (
            <div className="space-y-3">
              {/* Source tabs — horizontally scrollable */}
              <div className="px-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1.5 min-w-max">
                  {groups.map((group) => {
                    const platformKey = group.platform as Platform;
                    const meta = PLATFORM_META[platformKey] ?? PLATFORM_META.other;
                    const isActive = selectedGroup?.platform === group.platform;

                    return (
                      <button
                        key={group.platform}
                        onClick={() => setActiveSourceTab(group.platform)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                          isActive
                            ? `${meta.bgClass} ${meta.colorClass} font-semibold border border-current`
                            : "bg-surface-2 text-zinc-400 border border-zinc-800 hover:border-zinc-600"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
                            isActive ? "bg-white/10" : meta.bgClass + " " + meta.colorClass
                          }`}
                        >
                          {meta.abbreviation}
                        </span>
                        {meta.label}
                        <span
                          className={`text-[10px] ${isActive ? "opacity-70" : "text-zinc-500"}`}
                        >
                          {group.articles.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected source articles */}
              {selectedGroup && (
                <div className="px-4 space-y-2.5">
                  <p className="text-xs text-muted font-medium">
                    {selectedGroup.label} ({selectedGroup.articles.length} articles)
                  </p>
                  {selectedGroup.articles.map((article, index) => (
                    <div key={article.id} className="relative overflow-visible">
                      <div className="absolute -left-0.5 top-3 z-10 bg-brand-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div className="pl-5">
                        <ArticleCard
                          article={article}
                          currentRating={getRating(article.id)}
                          onRate={(id, rating) => {
                            optimisticRate(id, rating);
                            rateMutation.mutate({ id, rating });
                          }}
                          onToggleSave={(id) => saveMutation.mutate(id)}
                          onDismiss={dismiss}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
