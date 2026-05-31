"""Environment configuration for the ingestion pipeline."""

import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
REDDIT_CLIENT_ID: str = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET: str = os.environ.get("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT: str = os.environ.get("REDDIT_USER_AGENT", "ai-pulse/1.0")
UPSTASH_REDIS_URL: str = os.environ.get("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REDIS_TOKEN: str = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
GITHUB_PAT: str = os.environ.get("GH_TOKEN", "")


# Pipeline settings
DEDUP_FUZZY_THRESHOLD: int = 90
RECENCY_DECAY_HALF_LIFE_HOURS: int = 48
MAX_ARTICLES_PER_FETCH: int = 50
MAX_ARTICLES_PER_SOURCE: int = int(os.environ.get("MAX_ARTICLES_PER_SOURCE", "30"))
BATCH_UPSERT_SIZE: int = 50
# Non-saved articles older than this many days are deleted on each pipeline run.
# Saved articles (is_saved=True) are never deleted regardless of this setting.
ARTICLE_RETENTION_DAYS: int = int(os.environ.get("ARTICLE_RETENTION_DAYS", "30"))
