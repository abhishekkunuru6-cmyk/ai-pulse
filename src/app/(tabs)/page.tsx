"use client";

import { useCallback, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useTopics } from "@/lib/hooks/use-topics";
import { useArticles } from "@/lib/hooks/use-articles";
import { useFilters } from "@/lib/hooks/use-filters";
import { useRateArticle, useToggleSave } from "@/lib/hooks/use-article-mutations";
import { useSettingsFilter } from "@/lib/hooks/use-settings-filter";
import { useDismissedArticles } from "@/lib/hooks/use-dismissed-articles";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { TopicFeed } from "@/components/topics/topic-feed";
import { FilterChips } from "@/components/feed/filter-chips";
import { FilterPanel } from "@/components/feed/filter-panel";
import { ArticleList } from "@/components/feed/article-list";
import { IconRefresh } from "@/components/ui/icon";

type ViewMode = "topics" | "all";
type TimeRange = "today" | "week" | "month" | "year" | "all";
type RelevanceFilter = "all" | "hot" | "active";
type SortMode = "smart" | "hottest" | "foryou";

/** Combined score: relevance * 0.6 + hotness * 0.4 */
function smartScore(relevance: number, hotness: number): number {
  return relevance * 0.6 + hotness * 0.4;
}

export default function FeedPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("topics");
  const [timeRange, setTimeRangeLocal] = useState<TimeRange>("week");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [relevanceFilter, setRelevanceFilter] = useState<RelevanceFilter>("all");
  const [maxTopics, setMaxTopics] = useState(15);
  const [sortMode, setSortMode] = useState<SortMode>("smart");

  // Settings-based filtering
  const { filterArticles, filterTopics: filterTopicsBySettings } = useSettingsFilter();

  // Topic-based view
  const {
    topics,
    isLoading: topicsLoading,
    error: topicsError,
    refresh: refreshTopics,
  } = useTopics(timeRange);

  // Apply settings filter + client-side relevance filter + sort + max topics
  const filteredTopics = useMemo(() => {
    let filtered = filterTopicsBySettings(topics);

    if (relevanceFilter === "hot") {
      filtered = filtered.filter((t) => t.relevance_score >= 60);
    } else if (relevanceFilter === "active") {
      filtered = filtered.filter((t) => t.relevance_score >= 35);
    }

    // Apply sort mode
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "hottest") return b.hotness_score - a.hotness_score;
      if (sortMode === "foryou") return b.relevance_score - a.relevance_score;
      // "smart" — combined score: relevance 60% + hotness 40%
      return (
        smartScore(b.relevance_score, b.hotness_score) -
        smartScore(a.relevance_score, a.hotness_score)
      );
    });

    return sorted.slice(0, maxTopics);
  }, [topics, filterTopicsBySettings, relevanceFilter, sortMode, maxTopics]);

  // Flat article view (only fetched when viewMode is "all")
  const {
    filters,
    activeCount,
    apiParams,
    toggleContentType,
    togglePlatform,
    setTimeRange,
    toggleTopic,
    setEngagement,
    setReadStatus,
    clearAll,
  } = useFilters();

  const {
    articles: rawArticles,
    isLoading: articlesLoading,
    isLoadingMore,
    hasMore,
    error: articlesError,
    loadMore,
    refresh: refreshArticles,
  } = useArticles(apiParams);

  // Dismiss functionality
  const { dismiss, isDismissed } = useDismissedArticles();

  // Apply settings-based filtering + dismiss filtering + smart sort
  const articles = useMemo(() => {
    const filtered = filterArticles(rawArticles).filter((a) => !isDismissed(a.id));

    return [...filtered].sort((a, b) => {
      const aHotness = Math.max(0, Math.min(100, Number(a.engagement_score) || 0));
      const bHotness = Math.max(0, Math.min(100, Number(b.engagement_score) || 0));
      const aRelevance = a.relevance_score ?? aHotness;
      const bRelevance = b.relevance_score ?? bHotness;

      if (sortMode === "hottest") return bHotness - aHotness;
      if (sortMode === "foryou") return bRelevance - aRelevance;
      // "smart" — combined score
      return smartScore(bRelevance, bHotness) - smartScore(aRelevance, aHotness);
    });
  }, [rawArticles, filterArticles, isDismissed, sortMode]);

  const { getRating, optimisticRate } = usePreferences();
  const rateMutation = useRateArticle();
  const saveMutation = useToggleSave();

  const mutationError = rateMutation.error ?? saveMutation.error;

  // Fetch latest from sources (ingestion trigger)
  const [isFetching, setIsFetching] = useState(false);
  const triggerFetchLatest = useCallback(async () => {
    setIsFetching(true);
    try {
      await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: "all" }),
      });
      // Refresh the feed after ingestion
      if (viewMode === "topics") {
        refreshTopics();
      } else {
        refreshArticles();
      }
    } finally {
      setIsFetching(false);
    }
  }, [viewMode, refreshTopics, refreshArticles]);

  return (
    <div className="space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-lg font-bold text-zinc-100">
          {viewMode === "topics" ? "What's Happening" : "Your Feed"}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={triggerFetchLatest}
            disabled={isFetching}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 transition-colors disabled:opacity-50"
            title="Fetch latest articles from all sources"
          >
            {isFetching ? "Fetching..." : "Fetch Latest"}
          </button>
          <button
            onClick={viewMode === "topics" ? refreshTopics : refreshArticles}
            className="p-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
            aria-label="Refresh feed"
          >
            <IconRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View mode toggle + time range */}
      <div className="flex items-center gap-2 px-4">
        {/* View mode toggle */}
        <div className="flex bg-surface-2 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("topics")}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              viewMode === "topics"
                ? "bg-brand-600 text-white font-medium"
                : "text-muted hover:text-zinc-300"
            }`}
          >
            Topics
          </button>
          <button
            onClick={() => setViewMode("all")}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              viewMode === "all"
                ? "bg-brand-600 text-white font-medium"
                : "text-muted hover:text-zinc-300"
            }`}
          >
            All Articles
          </button>
        </div>

        {/* Time range (topics view only) */}
        {viewMode === "topics" && (
          <div className="flex bg-surface-2 rounded-lg p-0.5 ml-auto">
            {(
              [
                { value: "today", label: "24h" },
                { value: "week", label: "7d" },
                { value: "month", label: "30d" },
                { value: "year", label: "1y" },
                { value: "all", label: "All" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeRangeLocal(value)}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                  timeRange === value
                    ? "bg-zinc-700 text-zinc-100 font-medium"
                    : "text-muted hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort mode toggle */}
      <div className="flex items-center gap-1.5 px-4">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
          Sort:
        </span>
        <div className="flex bg-surface-2 rounded-lg p-0.5">
          {(
            [
              { value: "smart", label: "Smart" },
              { value: "hottest", label: "Hottest" },
              { value: "foryou", label: "For You" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSortMode(value)}
              className={clsx(
                "text-[10px] px-2.5 py-1 rounded-md transition-colors",
                sortMode === value
                  ? "bg-brand-600 text-white font-medium"
                  : "text-muted hover:text-zinc-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic preferences bar */}
      {viewMode === "topics" && (
        <div className="flex items-center gap-3 px-4 py-1">
          {/* Relevance filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Show:
            </span>
            {(["all", "active", "hot"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setRelevanceFilter(level)}
                className={clsx(
                  "text-[10px] px-2 py-0.5 rounded-md transition-colors capitalize",
                  relevanceFilter === level
                    ? level === "hot"
                      ? "bg-green-600/20 text-green-400 font-medium"
                      : level === "active"
                        ? "bg-yellow-600/20 text-yellow-400 font-medium"
                        : "bg-zinc-700 text-zinc-200 font-medium"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {level === "all" ? "All" : level === "active" ? "Active+" : "Hot only"}
              </button>
            ))}
          </div>

          {/* Max topics selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Limit:
            </span>
            {[15, 25, 50].map((n) => (
              <button
                key={n}
                onClick={() => setMaxTopics(n)}
                className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded-md transition-colors",
                  maxTopics === n
                    ? "bg-zinc-700 text-zinc-200 font-medium"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mutation error toast */}
      {mutationError && (
        <div className="mx-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-xs text-red-400">{(mutationError as Error).message}</p>
          <button
            onClick={() => {
              rateMutation.reset();
              saveMutation.reset();
            }}
            className="text-xs text-red-300 ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      {viewMode === "topics" ? (
        <TopicFeed
          topics={filteredTopics}
          isLoading={topicsLoading}
          error={topicsError}
          timeRange={timeRange}
        />
      ) : (
        <>
          {/* Filter chips (all articles view only) */}
          <FilterChips
            filters={filters}
            activeCount={activeCount}
            onToggleContentType={toggleContentType}
            onClearAll={clearAll}
            onTogglePanel={() => setIsFilterPanelOpen(true)}
          />

          {/* Article list */}
          <ArticleList
            articles={articles}
            isLoading={articlesLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            error={articlesError}
            onLoadMore={loadMore}
            onRate={(id, rating) => {
              optimisticRate(id, rating);
              rateMutation.mutate({ id, rating });
            }}
            onToggleSave={(id) => saveMutation.mutate(id)}
            onDismiss={dismiss}
            getRating={getRating}
          />

          {/* Filter panel (slide-up drawer) */}
          <FilterPanel
            isOpen={isFilterPanelOpen}
            onClose={() => setIsFilterPanelOpen(false)}
            filters={filters}
            activeCount={activeCount}
            onToggleContentType={toggleContentType}
            onTogglePlatform={togglePlatform}
            onSetTimeRange={setTimeRange}
            onToggleTopic={toggleTopic}
            onSetEngagement={setEngagement}
            onSetReadStatus={setReadStatus}
            onClearAll={clearAll}
          />
        </>
      )}
    </div>
  );
}
