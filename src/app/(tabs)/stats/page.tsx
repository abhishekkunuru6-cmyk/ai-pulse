"use client";

import { useStats } from "@/lib/hooks/use-stats";
import { CATEGORY_LABELS } from "@/lib/utils/category-meta";
import { IconRefresh } from "@/components/ui/icon";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";

const STATUS_COLORS: Readonly<Record<string, string>> = {
  active: "bg-green-400",
  paused: "bg-yellow-400",
  deprecated: "bg-zinc-500",
};

function StatCard({
  label,
  value,
  accent,
}: {
  readonly label: string;
  readonly value: number;
  readonly accent?: string;
}) {
  return (
    <div className="bg-surface-2 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${accent ?? "text-zinc-100"}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function BarChart({
  data,
  labels,
}: {
  readonly data: Readonly<Record<string, number>>;
  readonly labels: Readonly<Record<string, string>>;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const maxValue = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs text-zinc-300 w-24 text-right truncate">
            {labels[key] ?? key}
          </span>
          <div className="flex-1 h-5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${(value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted w-8 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { stats, isLoading, error, refetch } = useStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-lg font-bold text-zinc-100">Dashboard</h2>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
          aria-label="Refresh stats"
        >
          <IconRefresh className="w-4 h-4" />
        </button>
      </div>

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

      {!isLoading && stats && (
        <div className="px-4 space-y-6">
          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Articles" value={stats.total_articles} />
            <StatCard label="New Today" value={stats.articles_today} accent="text-brand-400" />
            <StatCard label="Unread" value={stats.unread_count} accent="text-amber-400" />
            <StatCard label="Saved" value={stats.saved_count} accent="text-green-400" />
          </div>

          {/* Sources overview */}
          <div className="bg-surface-2 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">
              Sources ({stats.total_sources})
            </h3>
            <div className="flex gap-4 mb-4">
              {Object.entries(stats.sources_by_status).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] ?? "bg-zinc-500"}`}
                  />
                  <span className="text-xs text-zinc-300 capitalize">{status}</span>
                  <span className="text-xs text-muted">({count})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sources by category chart */}
          {Object.keys(stats.sources_by_category).length > 0 && (
            <div className="bg-surface-2 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                Sources by Category
              </h3>
              <BarChart data={stats.sources_by_category} labels={CATEGORY_LABELS} />
            </div>
          )}
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
