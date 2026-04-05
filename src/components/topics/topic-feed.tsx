"use client";

import type { TopicCluster } from "@/types";
import { TopicCard } from "./topic-card";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";

interface TopicFeedProps {
  readonly topics: readonly TopicCluster[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly timeRange: string;
}

export function TopicFeed({ topics, isLoading, error, timeRange }: TopicFeedProps) {
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
        <p className="text-xs text-muted mt-1">
          Please check your connection and try again.
        </p>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-zinc-400">No topics found</p>
        <p className="text-xs text-muted mt-1">
          Try a different time range or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3">
      {topics.map((topic) => (
        <TopicCard key={topic.slug} topic={topic} timeRange={timeRange} />
      ))}

      {/* Finite end marker */}
      <p className="text-center text-xs text-muted py-4">
        {topics.length} topics from the past {timeRange === "today" ? "24 hours" : timeRange === "week" ? "7 days" : "30 days"}
      </p>
    </div>
  );
}
