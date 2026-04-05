"use client";

import { clsx } from "clsx";

interface RelevanceIndicatorProps {
  /** Score from 0-100. Higher = more relevant to the user. */
  readonly score: number;
  /** Size variant */
  readonly size?: "sm" | "md";
}

function getRelevanceLevel(score: number): {
  label: string;
  colorClass: string;
  bgClass: string;
  barColor: string;
} {
  if (score >= 80) {
    return {
      label: "For You",
      colorClass: "text-purple-400",
      bgClass: "bg-purple-500/15",
      barColor: "bg-gradient-to-r from-blue-500 to-purple-500",
    };
  }
  if (score >= 60) {
    return {
      label: "Relevant",
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/15",
      barColor: "bg-gradient-to-r from-cyan-500 to-blue-500",
    };
  }
  if (score >= 40) {
    return {
      label: "Maybe",
      colorClass: "text-cyan-400",
      bgClass: "bg-cyan-500/15",
      barColor: "bg-gradient-to-r from-teal-400 to-cyan-500",
    };
  }
  if (score >= 20) {
    return {
      label: "Low",
      colorClass: "text-teal-400",
      bgClass: "bg-teal-500/15",
      barColor: "bg-gradient-to-r from-emerald-500 to-teal-400",
    };
  }
  return {
    label: "Meh",
    colorClass: "text-zinc-400",
    bgClass: "bg-zinc-500/15",
    barColor: "bg-zinc-600",
  };
}

export function RelevanceIndicator({ score, size = "sm" }: RelevanceIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const { label, colorClass, bgClass, barColor } = getRelevanceLevel(clamped);

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md",
        bgClass,
        size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1",
      )}
      title={`Relevance: ${Math.round(clamped)}/100 — ${label}`}
    >
      {/* Gradient bar */}
      <div
        className={clsx(
          "rounded-full overflow-hidden bg-zinc-800",
          size === "sm" ? "w-8 h-1.5" : "w-12 h-2",
        )}
      >
        <div
          className={clsx("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        className={clsx(
          "font-semibold",
          colorClass,
          size === "sm" ? "text-[9px]" : "text-[10px]",
        )}
      >
        {label}
      </span>
    </div>
  );
}
