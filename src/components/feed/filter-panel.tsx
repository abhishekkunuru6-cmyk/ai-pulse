"use client";

import { useEffect, useRef, useCallback } from "react";
import { clsx } from "clsx";
import type { ContentType, Platform, EngagementFilter, ReadStatusFilter } from "@/types";
import type { FilterState } from "@/lib/hooks/use-filters";
import { CONTENT_TYPES, TOPICS } from "@/constants";
import { CONTENT_TYPE_META } from "@/lib/utils/content-type-meta";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import { TOPIC_LABELS } from "@/lib/utils/topic-meta";
import { IconX } from "@/components/ui/icon";

interface FilterPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly filters: FilterState;
  readonly activeCount: number;
  readonly onToggleContentType: (type: ContentType) => void;
  readonly onTogglePlatform: (platform: Platform) => void;
  readonly onSetTimeRange: (range: FilterState["timeRange"]) => void;
  readonly onToggleTopic: (topic: string) => void;
  readonly onSetEngagement: (engagement: EngagementFilter | null) => void;
  readonly onSetReadStatus: (readStatus: ReadStatusFilter | null) => void;
  readonly onClearAll: () => void;
}

const TIME_RANGES = [
  { value: "today" as const, label: "Today" },
  { value: "week" as const, label: "This Week" },
  { value: "month" as const, label: "This Month" },
  { value: "year" as const, label: "This Year" },
  { value: "all" as const, label: "All Time" },
];

const ENGAGEMENT_OPTIONS: readonly {
  value: EngagementFilter;
  label: string;
  description: string;
}[] = [
  { value: "trending", label: "Trending", description: "High engagement recently" },
  { value: "most_liked", label: "Most Liked", description: "Highest rated by you" },
  {
    value: "under_the_radar",
    label: "Under the Radar",
    description: "Low engagement, high-quality sources",
  },
];

const READ_STATUS_OPTIONS: readonly {
  value: ReadStatusFilter;
  label: string;
}[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "saved", label: "Saved" },
];

// Only show platforms that are likely to have data
const POPULAR_PLATFORMS: readonly Platform[] = [
  "hackernews",
  "reddit",
  "arxiv",
  "github",
  "blog",
  "newsletter",
  "youtube",
  "huggingface",
];

function FilterChip({
  label,
  isActive,
  colorClass,
  onClick,
}: {
  readonly label: string;
  readonly isActive: boolean;
  readonly colorClass?: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center rounded-full text-xs px-3 py-1.5 transition-all font-medium",
        isActive ? "bg-brand-600 text-white" : "bg-surface-2 text-zinc-400 hover:text-zinc-200",
        !isActive && colorClass,
      )}
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{children}</h3>
  );
}

export function FilterPanel({
  isOpen,
  onClose,
  filters,
  activeCount,
  onToggleContentType,
  onTogglePlatform,
  onSetTimeRange,
  onToggleTopic,
  onSetEngagement,
  onSetReadStatus,
  onClearAll,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open (classList is composable)
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  // Focus the close button when panel opens for accessibility
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Trap focus within the panel
  const handleKeyDownTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onKeyDown={handleKeyDownTrap}
        className="fixed inset-x-0 bottom-0 z-[60] bg-surface-1 rounded-t-2xl max-h-[85vh] flex flex-col animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Filter articles"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-100">Filters</h2>
            {activeCount > 0 && (
              <span className="bg-brand-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <button onClick={onClearAll} className="text-xs text-brand-400 font-medium">
                Clear all
              </button>
            )}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-1 text-muted hover:text-zinc-200 transition-colors"
              aria-label="Close filters"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Time Range */}
          <section>
            <SectionTitle>Time Range</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {TIME_RANGES.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  label={label}
                  isActive={filters.timeRange === value}
                  onClick={() => onSetTimeRange(value)}
                />
              ))}
            </div>
          </section>

          {/* Content Type */}
          <section>
            <SectionTitle>Content Type</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {CONTENT_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={CONTENT_TYPE_META[type].label}
                  isActive={filters.contentTypes.includes(type)}
                  onClick={() => onToggleContentType(type)}
                />
              ))}
            </div>
          </section>

          {/* Platform */}
          <section>
            <SectionTitle>Platform</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {POPULAR_PLATFORMS.map((platform) => (
                <FilterChip
                  key={platform}
                  label={PLATFORM_META[platform].label}
                  isActive={filters.platforms.includes(platform)}
                  colorClass={PLATFORM_META[platform].colorClass}
                  onClick={() => onTogglePlatform(platform)}
                />
              ))}
            </div>
          </section>

          {/* Topics */}
          <section>
            <SectionTitle>Topic</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((topic) => (
                <FilterChip
                  key={topic}
                  label={TOPIC_LABELS[topic] ?? topic}
                  isActive={filters.topics.includes(topic)}
                  onClick={() => onToggleTopic(topic)}
                />
              ))}
            </div>
          </section>

          {/* Engagement */}
          <section>
            <SectionTitle>Sort by Engagement</SectionTitle>
            <div className="space-y-2">
              {ENGAGEMENT_OPTIONS.map(({ value, label, description }) => (
                <button
                  key={value}
                  onClick={() => onSetEngagement(filters.engagement === value ? null : value)}
                  className={clsx(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-colors",
                    filters.engagement === value
                      ? "bg-brand-600/20 border border-brand-500/40"
                      : "bg-surface-2 border border-transparent hover:border-zinc-700",
                  )}
                >
                  <span
                    className={clsx(
                      "text-sm font-medium",
                      filters.engagement === value ? "text-brand-400" : "text-zinc-200",
                    )}
                  >
                    {label}
                  </span>
                  <p className="text-xs text-muted mt-0.5">{description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Read Status */}
          <section>
            <SectionTitle>Read Status</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {READ_STATUS_OPTIONS.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  label={label}
                  isActive={filters.readStatus === value}
                  onClick={() => onSetReadStatus(filters.readStatus === value ? null : value)}
                />
              ))}
            </div>
          </section>

          {/* Bottom spacing for safe area */}
          <div className="h-4" />
        </div>

        {/* Apply button (sticky at bottom) */}
        <div className="border-t border-zinc-800/60 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onClose}
            className="w-full bg-brand-600 text-white text-sm font-medium py-3 rounded-xl hover:bg-brand-700 transition-colors"
          >
            Show Results
          </button>
        </div>
      </div>
    </>
  );
}
