"use client";

import { useState, useCallback, useMemo } from "react";
import type { ContentType, Platform, EngagementFilter, ReadStatusFilter } from "@/types";

export interface FilterState {
  readonly contentTypes: readonly ContentType[];
  readonly platforms: readonly Platform[];
  readonly timeRange: "today" | "week" | "month" | "year" | "all";
  readonly topics: readonly string[];
  readonly engagement: EngagementFilter | null;
  readonly readStatus: ReadStatusFilter | null;
}

const INITIAL_FILTERS: FilterState = {
  contentTypes: [],
  platforms: [],
  timeRange: "all",
  topics: [],
  engagement: null,
  readStatus: null,
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const toggleContentType = useCallback((type: ContentType) => {
    setFilters((prev) => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(type)
        ? prev.contentTypes.filter((t) => t !== type)
        : [...prev.contentTypes, type],
    }));
  }, []);

  const togglePlatform = useCallback((platform: Platform) => {
    setFilters((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  }, []);

  const setTimeRange = useCallback((range: FilterState["timeRange"]) => {
    setFilters((prev) => ({ ...prev, timeRange: range }));
  }, []);

  const toggleTopic = useCallback((topic: string) => {
    setFilters((prev) => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic],
    }));
  }, []);

  const setEngagement = useCallback((engagement: EngagementFilter | null) => {
    setFilters((prev) => ({ ...prev, engagement }));
  }, []);

  const setReadStatus = useCallback((readStatus: ReadStatusFilter | null) => {
    setFilters((prev) => ({ ...prev, readStatus }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.contentTypes.length > 0) count += 1;
    if (filters.platforms.length > 0) count += 1;
    if (filters.timeRange !== "all") count += 1;
    if (filters.topics.length > 0) count += 1;
    if (filters.engagement !== null) count += 1;
    if (filters.readStatus !== null) count += 1;
    return count;
  }, [filters]);

  const apiParams = useMemo(() => {
    const params: Record<string, string> = {};

    if (filters.contentTypes.length > 0) {
      params.content_type = filters.contentTypes.join(",");
    }
    if (filters.platforms.length > 0) {
      params.platform = filters.platforms.join(",");
    }
    if (filters.timeRange !== "all") {
      params.time_range = filters.timeRange;
    }
    if (filters.topics.length > 0) {
      params.topic = filters.topics.join(",");
    }
    if (filters.engagement !== null) {
      params.engagement = filters.engagement;
    }
    if (filters.readStatus !== null) {
      params.read_status = filters.readStatus;
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }, [filters]);

  return {
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
  };
}
