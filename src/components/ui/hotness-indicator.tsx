"use client";

import { clsx } from "clsx";

interface HotnessIndicatorProps {
  /** Score from 0-100. Higher = hotter. */
  readonly score: number;
  /** Size variant */
  readonly size?: "sm" | "md";
}

function getHotnessLevel(score: number): {
  label: string;
  colorClass: string;
  bgClass: string;
  barColor: string;
} {
  if (score >= 80) {
    return {
      label: "On Fire",
      colorClass: "text-red-400",
      bgClass: "bg-red-500/15",
      barColor: "bg-gradient-to-r from-orange-500 to-red-500",
    };
  }
  if (score >= 60) {
    return {
      label: "Hot",
      colorClass: "text-orange-400",
      bgClass: "bg-orange-500/15",
      barColor: "bg-gradient-to-r from-yellow-500 to-orange-500",
    };
  }
  if (score >= 40) {
    return {
      label: "Warm",
      colorClass: "text-yellow-400",
      bgClass: "bg-yellow-500/15",
      barColor: "bg-gradient-to-r from-green-400 to-yellow-500",
    };
  }
  if (score >= 20) {
    return {
      label: "Mild",
      colorClass: "text-green-400",
      bgClass: "bg-green-500/15",
      barColor: "bg-gradient-to-r from-emerald-500 to-green-400",
    };
  }
  return {
    label: "Cool",
    colorClass: "text-zinc-400",
    bgClass: "bg-zinc-500/15",
    barColor: "bg-zinc-600",
  };
}

export function HotnessIndicator({ score, size = "sm" }: HotnessIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const { label, colorClass, bgClass, barColor } = getHotnessLevel(clamped);

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md",
        bgClass,
        size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1",
      )}
      title={`Hotness: ${Math.round(clamped)}/100 — ${label}`}
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
