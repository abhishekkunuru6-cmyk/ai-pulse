export type SourceCategory =
  | "research"
  | "social"
  | "code"
  | "news"
  | "company"
  | "conference"
  | "people"
  | "benchmark"
  | "podcast";

export type SourceType = "api" | "rss" | "scrape" | "manual";

export type SourceStatus = "active" | "paused" | "deprecated";

export type Platform =
  | "arxiv"
  | "reddit"
  | "hackernews"
  | "github"
  | "huggingface"
  | "youtube"
  | "linkedin"
  | "x"
  | "blog"
  | "newsletter"
  | "discord"
  | "lobsters"
  | "pypi"
  | "semantic_scholar"
  | "papers_with_code"
  | "openreview"
  | "ollama"
  | "other";

export type ContentType =
  | "paper"
  | "blog"
  | "news"
  | "social"
  | "code"
  | "newsletter"
  | "video"
  | "podcast"
  | "benchmark";

export type Rating = "up" | "down";

export type FetchFrequency = "hourly" | "every_4h" | "every_6h" | "every_12h" | "daily" | "weekly";

export interface Source {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly category: SourceCategory;
  readonly type: SourceType;
  readonly status: SourceStatus;
  readonly platform: Platform;
  readonly added_on: string;
  readonly last_fetched: string | null;
  readonly fetch_frequency: FetchFrequency;
  readonly reliability_score: number;
  readonly notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Article {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source_id: string;
  readonly published_at: string | null;
  readonly fetched_at: string;
  readonly summary_snippet: string | null;
  readonly content_type: ContentType;
  readonly topic_tags: readonly string[];
  readonly platform: Platform;
  readonly engagement_score: number;
  readonly engagement_metrics: Record<string, unknown>;
  readonly recommendation_reason: string | null;
  readonly is_read: boolean;
  readonly is_saved: boolean;
  /** Personalized relevance score (0-100), computed by LLM from user preferences */
  readonly relevance_score: number | null;
  readonly created_at: string;
}

export interface ArticlePreference {
  readonly id: string;
  readonly article_id: string;
  readonly rating: Rating;
  readonly created_at: string;
}

export interface SourceRating {
  readonly id: string;
  readonly source_id: string;
  readonly star_rating: number;
  readonly created_at: string;
}

export interface FilterPreset {
  readonly id: string;
  readonly name: string;
  readonly filter_config: FilterConfig;
  readonly created_at: string;
}

export interface FilterConfig {
  readonly content_type?: readonly ContentType[];
  readonly platform?: readonly Platform[];
  readonly time_range?: TimeRange;
  readonly quality?: QualityFilter;
  readonly topics?: readonly string[];
  readonly engagement?: EngagementFilter;
  readonly read_status?: ReadStatusFilter;
}

export type TimeRange = "today" | "week" | "month" | "all" | { from: string; to: string };

export type QualityFilter = "top_rated" | "all_rated" | "unrated" | "all";

export type EngagementFilter = "trending" | "most_liked" | "controversial" | "under_the_radar";

export type ReadStatusFilter = "unread" | "read" | "saved";

export interface DashboardStats {
  readonly total_articles: number;
  readonly total_sources: number;
  readonly articles_today: number;
  readonly unread_count: number;
  readonly saved_count: number;
  readonly sources_by_status: Readonly<Record<string, number>>;
  readonly sources_by_category: Readonly<Record<string, number>>;
}
