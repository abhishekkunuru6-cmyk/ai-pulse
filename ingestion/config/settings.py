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
# Cleanup triggers only when the article table reaches this many rows.
# Below this number, nothing is deleted — full history is preserved.
# Supabase free tier allows 50K rows; trigger at 45K to leave headroom.
ARTICLE_CLEANUP_THRESHOLD: int = int(os.environ.get("ARTICLE_CLEANUP_THRESHOLD", "45000"))
# When cleanup runs, delete oldest non-saved articles down to this row count.
ARTICLE_TARGET_ROWS: int = int(os.environ.get("ARTICLE_TARGET_ROWS", "40000"))
