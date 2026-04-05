import type { DigestPeriod } from "@/lib/schemas";

export const queryKeys = {
  articles: {
    all: ["articles"] as const,
    list: (filters?: Readonly<Record<string, string>>) =>
      [...queryKeys.articles.all, "list", JSON.stringify(filters ?? {})] as const,
    detail: (id: string) => [...queryKeys.articles.all, "detail", id] as const,
    search: (query: string) => [...queryKeys.articles.all, "search", query] as const,
    saved: () => [...queryKeys.articles.all, "saved"] as const,
  },
  digest: {
    all: ["digest"] as const,
    byPeriod: (period: DigestPeriod, limit?: number) =>
      [...queryKeys.digest.all, period, limit ?? "default"] as const,
    bySource: (period: DigestPeriod, perSource: number) =>
      [...queryKeys.digest.all, "by-source", period, perSource] as const,
    summary: (period: DigestPeriod) => [...queryKeys.digest.all, "summary", period] as const,
  },
  sources: {
    all: ["sources"] as const,
    list: () => [...queryKeys.sources.all, "list"] as const,
  },
  stats: {
    all: ["stats"] as const,
    dashboard: () => [...queryKeys.stats.all, "dashboard"] as const,
  },
  topics: {
    all: ["topics"] as const,
    list: (timeRange: string) => ["topics", "list", timeRange] as const,
    detail: (slug: string, timeRange: string, articleIds?: readonly string[]) =>
      ["topics", "detail", slug, timeRange, articleIds?.join(",") ?? ""] as const,
  },
} as const;
