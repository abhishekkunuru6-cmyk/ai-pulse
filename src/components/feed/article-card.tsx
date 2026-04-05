"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { Article } from "@/types";
import { formatRelativeTime, formatDate } from "@/lib/utils/format-time";
import { IconClock } from "@/components/ui/icon";
import { formatCompactNumber } from "@/lib/utils/format-number";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import { IconStar, IconExternalLink } from "@/components/ui/icon";
import { ContentTypeBadge, PlatformBadge } from "./article-card-badge";
import { ArticleCardActions } from "./article-card-actions";
import { HotnessIndicator } from "@/components/ui/hotness-indicator";
import { RelevanceIndicator } from "@/components/ui/relevance-indicator";

interface ArticleCardProps {
  readonly article: Article;
  readonly currentRating?: "up" | "down" | null;
  readonly onRate: (id: string, rating: "up" | "down" | "none") => void;
  readonly onToggleSave: (id: string) => void;
  readonly onDismiss?: (id: string) => void;
}

function getPlatformEngagement(article: Article): string | null {
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

/** Clamp engagement_score to 0–100 for hotness display.
 *  The score is already normalized to 0–100 by the /api/recompute endpoint. */
function computeHotness(engagementScore: number): number {
  if (engagementScore <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(engagementScore)));
}

export function ArticleCard({
  article,
  currentRating,
  onRate,
  onToggleSave,
  onDismiss,
}: ArticleCardProps) {
  const platformMeta = PLATFORM_META[article.platform];
  const engagementScore = Number(article.engagement_score) || 0;
  const isTrending = engagementScore > 100;
  const engagementLabel = getPlatformEngagement(article);
  const hotness = computeHotness(engagementScore);
  const relevance = article.relevance_score;

  // Optimistic save state — flips immediately on tap, syncs with server data
  const [isSavedOptimistic, setIsSavedOptimistic] = useState(article.is_saved);
  useEffect(() => {
    setIsSavedOptimistic(article.is_saved);
  }, [article.is_saved]);

  return (
    <article
      className={clsx(
        "bg-surface-1 rounded-xl border border-zinc-800/60 p-4 space-y-2.5 animate-fade-in",
        article.is_read && "opacity-60",
      )}
    >
      {/* Badge + date + engagement row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-200 text-xs font-semibold px-2 py-0.5 rounded-md">
          <IconClock className="w-3 h-3 text-zinc-400" />
          {formatDate(article.published_at)}
        </span>
        <span className="text-[10px] text-muted">{formatRelativeTime(article.published_at)}</span>
        <ContentTypeBadge contentType={article.content_type} isTrending={isTrending} />
        {engagementLabel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-600/15 text-amber-400">
            <IconStar className="w-3 h-3" />
            {engagementLabel}
          </span>
        )}
        {hotness > 0 && <HotnessIndicator score={hotness} />}
        {relevance !== null && relevance !== undefined && relevance > 0 && (
          <RelevanceIndicator score={relevance} />
        )}
        {article.is_read && <span className="text-[10px] text-zinc-500">Read</span>}
      </div>

      {/* Title — links to internal detail page */}
      <Link
        href={`/article/${article.id}`}
        className={clsx(
          "text-sm font-medium leading-snug block hover:underline",
          article.is_read ? "text-zinc-400" : "text-zinc-100",
        )}
      >
        {article.title}
      </Link>

      {/* Summary */}
      {article.summary_snippet && (
        <p className="text-xs text-muted leading-relaxed line-clamp-2">{article.summary_snippet}</p>
      )}

      {/* Footer: platform + tags */}
      <div className="flex items-center gap-2">
        <PlatformBadge platform={article.platform} />
        <span className="text-[10px] text-zinc-400">{platformMeta.label}</span>
        {engagementLabel && (
          <>
            <span className="text-[10px] text-muted">·</span>
            <span className="text-[10px] text-muted">{engagementLabel}</span>
          </>
        )}
        {article.topic_tags.length > 0 && (
          <>
            <span className="text-[10px] text-muted">·</span>
            <span className="text-[10px] text-zinc-500">{article.topic_tags[0]}</span>
          </>
        )}
      </div>

      {/* Bottom bar: Read link + action buttons */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 bg-brand-600/10 hover:bg-brand-600/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <IconExternalLink className="w-3.5 h-3.5" />
          Read
        </a>
        <ArticleCardActions
          isSaved={isSavedOptimistic}
          currentRating={currentRating}
          onRate={(rating) => onRate(article.id, rating)}
          onToggleSave={() => {
            setIsSavedOptimistic((prev) => !prev);
            onToggleSave(article.id);
          }}
          onDismiss={onDismiss ? () => onDismiss(article.id) : undefined}
        />
      </div>
    </article>
  );
}
