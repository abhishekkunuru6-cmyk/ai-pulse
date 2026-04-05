import type { Article, ContentType, Platform } from "./database";

export interface TopicCluster {
  readonly slug: string;
  readonly label: string;
  readonly summary: string;
  readonly article_count: number;
  readonly content_types: readonly ContentType[];
  readonly platforms: readonly Platform[];
  readonly latest_date: string | null;
  readonly oldest_date: string | null;
  /** Preview articles shown on the topic card (top 4 by engagement) */
  readonly top_articles: readonly Article[];
  /** IDs of all articles in this cluster — used by detail page to fetch exact same articles */
  readonly article_ids: readonly string[];
  readonly total_engagement: number;
  /** Objective buzz/popularity score (0-100) — same for every user */
  readonly hotness_score: number;
  /** Personalized relevance score (0-100) — LLM-powered, based on user preferences */
  readonly relevance_score: number;
}
