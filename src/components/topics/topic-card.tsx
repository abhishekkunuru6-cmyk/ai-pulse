"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { TopicCluster } from "@/types";
import { formatDate, formatDateRange } from "@/lib/utils/format-time";
import { CONTENT_TYPE_META } from "@/lib/utils/content-type-meta";
import { IconClock, IconExternalLink } from "@/components/ui/icon";
import { formatCompactNumber } from "@/lib/utils/format-number";
import { HotnessIndicator } from "@/components/ui/hotness-indicator";
import { RelevanceIndicator } from "@/components/ui/relevance-indicator";

interface TopicCardProps {
  readonly topic: TopicCluster;
  readonly timeRange: string;
}

function getArticleEngagementLabel(article: {
  readonly platform: string;
  readonly engagement_metrics: Record<string, unknown>;
  readonly engagement_score: number;
}): string | null {
  const metrics = article.engagement_metrics;

  if (article.platform === "github") {
    const stars = Number(metrics?.stars ?? 0);
    if (stars > 0) return `${formatCompactNumber(stars)} stars`;
  }
  if (article.platform === "hackernews") {
    const points = Number(metrics?.points ?? 0);
    if (points > 0) return `${formatCompactNumber(points)} pts`;
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

export function TopicCard({ topic, timeRange }: TopicCardProps) {
  return (
    <Link
      href={`/topic/${topic.slug}?t=${timeRange}`}
      className="block bg-surface-1 rounded-xl border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-colors animate-fade-in"
    >
      {/* Header: topic name + relevance badge + article count */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-base font-semibold text-zinc-100 leading-snug truncate">
            {topic.label}
          </h3>
          <HotnessIndicator score={topic.hotness_score} />
          <RelevanceIndicator score={topic.relevance_score} />
        </div>
        <span className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-full flex-shrink-0">
          {topic.article_count} {topic.article_count === 1 ? "article" : "articles"}
        </span>
      </div>

      {/* Top recommended article */}
      {topic.top_articles.length > 0 && (
        <p className="text-xs text-zinc-300 leading-snug line-clamp-2 mb-2">
          <span className="text-zinc-500 mr-1">Top:</span>
          {topic.top_articles[0].title}
        </p>
      )}

      {/* Date range + content type pills */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <IconClock className="w-3 h-3" />
          <span>{formatDateRange(topic.oldest_date, topic.latest_date)}</span>
        </div>
        {topic.content_types.map((type) => {
          const meta = CONTENT_TYPE_META[type];
          return (
            <span
              key={type}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.colorClass} ${meta.bgClass}`}
            >
              {meta.label}
            </span>
          );
        })}
      </div>

      {/* Preview articles with engagement */}
      <div className="space-y-1.5">
        {topic.top_articles.slice(0, 3).map((article) => {
          const engLabel = getArticleEngagementLabel(article);
          return (
            <div key={article.id} className="flex items-start gap-2">
              <span className="text-[10px] text-zinc-500 mt-0.5 flex-shrink-0 tabular-nums">
                {formatDate(article.published_at)}
              </span>
              <span
                className={`text-[10px] mt-0.5 flex-shrink-0 ${CONTENT_TYPE_META[article.content_type].colorClass}`}
              >
                {CONTENT_TYPE_META[article.content_type].label}
              </span>
              <p className="text-xs text-zinc-300 line-clamp-1 flex-1">{article.title}</p>
              {engLabel && (
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-600/15 px-1.5 py-0.5 rounded flex-shrink-0 tabular-nums">
                  {engLabel}
                </span>
              )}
            </div>
          );
        })}
        {topic.article_count > 3 && (
          <p className="text-[10px] text-brand-400 flex items-center gap-1">
            <IconExternalLink className="w-3 h-3" />+{topic.article_count - 3} more
          </p>
        )}
      </div>
    </Link>
  );
}
