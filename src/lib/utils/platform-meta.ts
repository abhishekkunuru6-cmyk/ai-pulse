import type { Platform } from "@/types";

export interface PlatformMeta {
  readonly label: string;
  readonly abbreviation: string;
  readonly colorClass: string;
  readonly bgClass: string;
}

export const PLATFORM_META: Readonly<Record<Platform, PlatformMeta>> = {
  hackernews: {
    label: "Hacker News",
    abbreviation: "HN",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-600/20",
  },
  reddit: {
    label: "Reddit",
    abbreviation: "RD",
    colorClass: "text-orange-500",
    bgClass: "bg-orange-500/20",
  },
  arxiv: {
    label: "ArXiv",
    abbreviation: "Ax",
    colorClass: "text-red-400",
    bgClass: "bg-red-600/20",
  },
  github: {
    label: "GitHub",
    abbreviation: "GH",
    colorClass: "text-zinc-100",
    bgClass: "bg-zinc-600/20",
  },
  huggingface: {
    label: "Hugging Face",
    abbreviation: "HF",
    colorClass: "text-yellow-400",
    bgClass: "bg-yellow-600/20",
  },
  youtube: {
    label: "YouTube",
    abbreviation: "YT",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/20",
  },
  blog: {
    label: "Blog",
    abbreviation: "BL",
    colorClass: "text-cyan-400",
    bgClass: "bg-cyan-600/20",
  },
  newsletter: {
    label: "Newsletter",
    abbreviation: "NL",
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-600/20",
  },
  linkedin: {
    label: "LinkedIn",
    abbreviation: "LI",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/20",
  },
  x: {
    label: "X",
    abbreviation: "X",
    colorClass: "text-zinc-100",
    bgClass: "bg-zinc-600/20",
  },
  discord: {
    label: "Discord",
    abbreviation: "DC",
    colorClass: "text-violet-400",
    bgClass: "bg-violet-600/20",
  },
  lobsters: {
    label: "Lobsters",
    abbreviation: "LB",
    colorClass: "text-red-400",
    bgClass: "bg-red-600/20",
  },
  pypi: {
    label: "PyPI",
    abbreviation: "Pi",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-600/20",
  },
  semantic_scholar: {
    label: "Semantic Scholar",
    abbreviation: "SS",
    colorClass: "text-blue-300",
    bgClass: "bg-blue-600/20",
  },
  papers_with_code: {
    label: "Papers With Code",
    abbreviation: "PwC",
    colorClass: "text-teal-400",
    bgClass: "bg-teal-600/20",
  },
  openreview: {
    label: "OpenReview",
    abbreviation: "OR",
    colorClass: "text-green-400",
    bgClass: "bg-green-600/20",
  },
  ollama: {
    label: "Ollama",
    abbreviation: "OL",
    colorClass: "text-zinc-300",
    bgClass: "bg-zinc-600/20",
  },
  other: {
    label: "Other",
    abbreviation: "??",
    colorClass: "text-zinc-400",
    bgClass: "bg-zinc-600/20",
  },
} as const;
