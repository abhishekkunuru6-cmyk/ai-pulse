import type { ContentType } from "@/types";

export interface ContentTypeMeta {
  readonly label: string;
  readonly colorClass: string;
  readonly bgClass: string;
}

export const CONTENT_TYPE_META: Readonly<Record<ContentType, ContentTypeMeta>> = {
  paper: {
    label: "Paper",
    colorClass: "text-purple-400",
    bgClass: "bg-purple-400/10",
  },
  blog: {
    label: "Blog",
    colorClass: "text-cyan-400",
    bgClass: "bg-cyan-400/10",
  },
  news: {
    label: "News",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-400/10",
  },
  social: {
    label: "Social",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-400/10",
  },
  code: {
    label: "Code",
    colorClass: "text-green-400",
    bgClass: "bg-green-400/10",
  },
  newsletter: {
    label: "Newsletter",
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-400/10",
  },
  video: {
    label: "Video",
    colorClass: "text-red-400",
    bgClass: "bg-red-400/10",
  },
  podcast: {
    label: "Podcast",
    colorClass: "text-pink-400",
    bgClass: "bg-pink-400/10",
  },
  benchmark: {
    label: "Benchmark",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-400/10",
  },
} as const;
