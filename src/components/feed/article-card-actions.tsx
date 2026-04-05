"use client";

import { clsx } from "clsx";
import { IconThumbsUp, IconThumbsDown, IconBookmark, IconX } from "@/components/ui/icon";

interface ArticleCardActionsProps {
  readonly isSaved: boolean;
  readonly currentRating?: "up" | "down" | null;
  readonly onRate: (rating: "up" | "down" | "none") => void;
  readonly onToggleSave: () => void;
  readonly onDismiss?: () => void;
}

export function ArticleCardActions({
  isSaved,
  currentRating,
  onRate,
  onToggleSave,
  onDismiss,
}: ArticleCardActionsProps) {
  const isLiked = currentRating === "up";
  const isDisliked = currentRating === "down";

  return (
    <div className="flex items-center gap-1">
      {/* Like */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate(isLiked ? "none" : "up");
        }}
        className={clsx(
          "group relative flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200",
          isLiked
            ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
            : "text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10",
        )}
        aria-label={isLiked ? "Remove like" : "Like"}
      >
        <IconThumbsUp
          className={clsx("w-3.5 h-3.5 transition-transform duration-200", isLiked && "scale-110")}
          fill={isLiked ? "currentColor" : "none"}
        />
        {isLiked && <span className="text-[10px] font-semibold">Liked</span>}
      </button>

      {/* Dislike */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate(isDisliked ? "none" : "down");
        }}
        className={clsx(
          "group relative flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200",
          isDisliked
            ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
            : "text-zinc-500 hover:text-red-400 hover:bg-red-500/10",
        )}
        aria-label={isDisliked ? "Remove dislike" : "Dislike"}
      >
        <IconThumbsDown
          className={clsx(
            "w-3.5 h-3.5 transition-transform duration-200",
            isDisliked && "scale-110",
          )}
          fill={isDisliked ? "currentColor" : "none"}
        />
        {isDisliked && <span className="text-[10px] font-semibold">Disliked</span>}
      </button>

      {/* Bookmark */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave();
        }}
        className={clsx(
          "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200",
          isSaved
            ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
            : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10",
        )}
        aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
      >
        <IconBookmark
          className={clsx("w-3.5 h-3.5 transition-transform duration-200", isSaved && "scale-110")}
          fill={isSaved ? "currentColor" : "none"}
        />
        {isSaved && <span className="text-[10px] font-semibold">Saved</span>}
      </button>

      {/* Dismiss */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700/40 transition-all duration-200"
          aria-label="Dismiss article"
          title="Remove from feed"
        >
          <IconX className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
