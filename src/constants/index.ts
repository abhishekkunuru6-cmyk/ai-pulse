export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
} as const;

export const ARTICLE_TTL_DAYS = 90;

export const SOURCE_CATEGORIES = [
  "research",
  "social",
  "code",
  "news",
  "company",
  "conference",
  "people",
  "benchmark",
  "podcast",
] as const;

export const PLATFORMS = [
  "arxiv",
  "reddit",
  "hackernews",
  "github",
  "huggingface",
  "youtube",
  "linkedin",
  "x",
  "blog",
  "newsletter",
  "discord",
  "lobsters",
  "pypi",
  "semantic_scholar",
  "papers_with_code",
  "openreview",
  "ollama",
  "other",
] as const;

export const CONTENT_TYPES = [
  "paper",
  "blog",
  "news",
  "social",
  "code",
  "newsletter",
  "video",
  "podcast",
  "benchmark",
] as const;

export const TOPICS = [
  "llms",
  "computer-vision",
  "reinforcement-learning",
  "ai-safety",
  "mlops",
  "open-source-models",
  "multimodal",
  "agents",
  "hardware",
  "startups",
] as const;
