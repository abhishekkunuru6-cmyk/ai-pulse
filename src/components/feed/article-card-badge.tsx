import type { ContentType, Platform } from "@/types";
import { CONTENT_TYPE_META } from "@/lib/utils/content-type-meta";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import { clsx } from "clsx";

interface ContentTypeBadgeProps {
  readonly contentType: ContentType;
  readonly isTrending?: boolean;
}

export function ContentTypeBadge({
  contentType,
  isTrending,
}: ContentTypeBadgeProps) {
  const meta = CONTENT_TYPE_META[contentType];

  if (isTrending) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
        Trending
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
        meta.colorClass,
        meta.bgClass,
      )}
    >
      {meta.label}
    </span>
  );
}

interface PlatformBadgeProps {
  readonly platform: Platform;
}

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  const meta = PLATFORM_META[platform];

  return (
    <div
      className={clsx(
        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0",
        meta.colorClass,
        meta.bgClass,
      )}
    >
      {meta.abbreviation}
    </div>
  );
}
