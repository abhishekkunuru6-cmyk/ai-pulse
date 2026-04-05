"use client";

import { Chip } from "@/components/ui/chip";
import { IconFilter } from "@/components/ui/icon";
import { CONTENT_TYPES } from "@/constants";
import { CONTENT_TYPE_META } from "@/lib/utils/content-type-meta";
import type { FilterState } from "@/lib/hooks/use-filters";
import type { ContentType } from "@/types";

interface FilterChipsProps {
  readonly filters: FilterState;
  readonly activeCount: number;
  readonly onToggleContentType: (type: ContentType) => void;
  readonly onClearAll: () => void;
  readonly onTogglePanel: () => void;
}

export function FilterChips({
  filters,
  activeCount,
  onToggleContentType,
  onClearAll,
  onTogglePanel,
}: FilterChipsProps) {
  const isAllSelected = activeCount === 0;

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 py-2">
      {/* Filter panel toggle button */}
      <Chip
        variant={activeCount > 0 ? "selected" : "default"}
        onClick={onTogglePanel}
        className="gap-1"
      >
        <IconFilter className="w-3 h-3" />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 bg-white/20 rounded-full px-1.5 text-[10px]">
            {activeCount}
          </span>
        )}
      </Chip>

      {/* All chip */}
      <Chip
        variant={isAllSelected ? "selected" : "default"}
        onClick={onClearAll}
      >
        All
      </Chip>

      {/* Quick-access content type chips */}
      {CONTENT_TYPES.map((type) => {
        const meta = CONTENT_TYPE_META[type];
        const isActive = filters.contentTypes.includes(type);

        return (
          <Chip
            key={type}
            variant={isActive ? "selected" : "default"}
            onClick={() => onToggleContentType(type)}
          >
            {meta.label}
          </Chip>
        );
      })}
    </div>
  );
}
