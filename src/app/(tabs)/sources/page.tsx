"use client";

import { useState, useMemo } from "react";
import type { SourceCategory, SourceStatus } from "@/types";
import { SOURCE_CATEGORIES } from "@/constants";
import { useSources } from "@/lib/hooks/use-sources";
import { useStats } from "@/lib/hooks/use-stats";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import { CATEGORY_LABELS } from "@/lib/utils/category-meta";
import { formatRelativeTime } from "@/lib/utils/format-time";
import { Chip } from "@/components/ui/chip";
import { IconRefresh, IconStar, IconExternalLink } from "@/components/ui/icon";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";
import type { Source } from "@/types";

const STATUS_OPTIONS: readonly { value: SourceStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "deprecated", label: "Deprecated" },
];

function StatusDot({ status }: { readonly status: SourceStatus }) {
  const colorClass =
    status === "active" ? "bg-green-400" : status === "paused" ? "bg-yellow-400" : "bg-zinc-500";

  return <span className={`w-2 h-2 rounded-full ${colorClass}`} />;
}

function SourceCard({ source }: { readonly source: Source }) {
  const platformMeta = PLATFORM_META[source.platform];

  return (
    <div className="bg-surface-2 rounded-xl p-3 space-y-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={source.status} />
          <span className="text-sm font-medium text-zinc-100 truncate">{source.name}</span>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1 text-muted hover:text-zinc-200 transition-colors"
          aria-label={`Open ${source.name}`}
        >
          <IconExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${platformMeta.bgClass} ${platformMeta.colorClass}`}
        >
          {platformMeta.label}
        </span>
        <span className="text-[10px] text-muted bg-surface-3 px-1.5 py-0.5 rounded">
          {CATEGORY_LABELS[source.category]}
        </span>
        <span className="text-[10px] text-muted bg-surface-3 px-1.5 py-0.5 rounded capitalize">
          {source.type}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted">
        <div className="flex items-center gap-1">
          <IconStar className="w-3 h-3 text-amber-400" />
          <span>{source.reliability_score.toFixed(1)}</span>
        </div>
        <span>
          {source.last_fetched
            ? `Last fetched ${formatRelativeTime(source.last_fetched)}`
            : "Never fetched"}
        </span>
      </div>

      {source.notes && <p className="text-[11px] text-zinc-400 line-clamp-2">{source.notes}</p>}
    </div>
  );
}

export default function SourcesPage() {
  const [statusFilter, setStatusFilter] = useState<SourceStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<SourceCategory | "all">("all");

  const { sources, isLoading, error, refetch } = useSources();
  const { stats, isLoading: isLoadingStats } = useStats();

  const filteredSources = useMemo(() => {
    return sources.filter((source) => {
      if (statusFilter !== "all" && source.status !== statusFilter) return false;
      if (categoryFilter !== "all" && source.category !== categoryFilter) return false;
      return true;
    });
  }, [sources, statusFilter, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const source of sources) {
      counts[source.category] = (counts[source.category] ?? 0) + 1;
    }
    return counts;
  }, [sources]);

  const uniqueCategories = useMemo(() => {
    return SOURCE_CATEGORIES.filter((cat) => categoryCounts[cat] !== undefined);
  }, [categoryCounts]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-zinc-100">Sources</h2>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
            aria-label="Refresh sources"
          >
            <IconRefresh className="w-4 h-4" />
          </button>
        </div>
        {!isLoading && (
          <p className="text-xs text-muted">
            {sources.length} sources tracked &middot; {filteredSources.length} shown
          </p>
        )}
      </div>

      {/* Stats summary */}
      {!isLoadingStats && stats && (
        <div className="px-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-zinc-100">
                {stats.total_articles.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">Articles</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-brand-400">
                {stats.articles_today.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">Today</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">
                {stats.unread_count.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">Unread</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-green-400">
                {stats.saved_count.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">Saved</p>
            </div>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <Chip
            key={value}
            variant={statusFilter === value ? "selected" : "default"}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Chip>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4">
        <Chip
          variant={categoryFilter === "all" ? "selected" : "default"}
          onClick={() => setCategoryFilter("all")}
        >
          All Categories
        </Chip>
        {uniqueCategories.map((cat) => (
          <Chip
            key={cat}
            variant={categoryFilter === cat ? "selected" : "default"}
            onClick={() => setCategoryFilter(cat)}
          >
            {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
          </Chip>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="px-4">
          <FeedSkeleton />
        </div>
      )}

      {!isLoading && error && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!isLoading && !error && filteredSources.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-zinc-400">No sources match your filters</p>
          <p className="text-xs text-muted mt-1">Try adjusting the status or category filter.</p>
        </div>
      )}

      {!isLoading && !error && filteredSources.length > 0 && (
        <div className="px-4 space-y-3">
          {filteredSources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
