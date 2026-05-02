"""Main entry point for the ingestion pipeline.

Usage:
    python -m ingestion.run --sources hackernews,rss,reddit
    python -m ingestion.run --all
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timedelta, timezone

from supabase import create_client

from ingestion.config.settings import (
    BATCH_UPSERT_SIZE,
    MAX_ARTICLES_PER_SOURCE,
    SUPABASE_KEY,
    SUPABASE_URL,
)
from ingestion.fetchers import (
    ArXivFetcher,
    GitHubTrendingFetcher,
    HackerNewsFetcher,
    HuggingFaceFetcher,
    OpenReviewFetcher,
    PapersWithCodeFetcher,
    RedditFetcher,
    RSSFetcher,
    SemanticScholarFetcher,
)
from ingestion.fetchers.base import BaseFetcher
from ingestion.models import NormalizedArticle, Source
from ingestion.pipeline.deduplicator import deduplicate
from ingestion.pipeline.normalizer import normalize
from ingestion.pipeline.scorer import build_author_reputation, score_articles
from ingestion.pipeline.tagger import tag_articles

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ingestion")

_github_fetcher = GitHubTrendingFetcher()

FETCHER_MAP: dict[str, BaseFetcher] = {
    "hackernews": HackerNewsFetcher(),
    "reddit": RedditFetcher(),
    "rss": RSSFetcher(),
    "arxiv": ArXivFetcher(),
    "semantic_scholar": SemanticScholarFetcher(),
    "papers_with_code": PapersWithCodeFetcher(),
    "openreview": OpenReviewFetcher(),
    "huggingface": HuggingFaceFetcher(),
    "github_trending": _github_fetcher,
    "github": _github_fetcher,  # alias: workflow passes --sources github
}

# Which platform values map to which fetcher
PLATFORM_TO_FETCHER: dict[str, str] = {
    "hackernews": "hackernews",
    "reddit": "reddit",
    "blog": "rss",
    "newsletter": "rss",
    "youtube": "rss",  # YouTube channels often have RSS feeds
    "lobsters": "rss",  # Lobsters provides RSS feeds for tag-filtered content
    "arxiv": "arxiv",
    "semantic_scholar": "semantic_scholar",
    "papers_with_code": "papers_with_code",
    "openreview": "openreview",
    "huggingface": "huggingface",
    "github": "github_trending",
}


_GITHUB_MAX_FRACTION = 0.30  # GitHub articles capped at 30% of total for diversity


def _enforce_github_cap(articles: list[NormalizedArticle]) -> list[NormalizedArticle]:
    """Cap GitHub articles to 30% of the total batch to maintain feed diversity.

    Keeps the highest-scoring GitHub articles up to the cap; all non-GitHub
    articles are kept unchanged.
    """
    if not articles:
        return articles

    github = [a for a in articles if a.platform == "github"]
    others = [a for a in articles if a.platform != "github"]

    max_github = max(1, int(len(articles) * _GITHUB_MAX_FRACTION))
    if len(github) <= max_github:
        return articles

    github_sorted = sorted(github, key=lambda a: a.engagement_score, reverse=True)
    kept = github_sorted[:max_github]
    logger.info(
        "GitHub diversity cap applied: keeping %d/%d GitHub articles (%.0f%% of %d total)",
        max_github,
        len(github),
        _GITHUB_MAX_FRACTION * 100,
        len(articles),
    )
    return others + kept


class PipelineConfigError(RuntimeError):
    """Raised when required configuration is missing."""


_FETCH_CONCURRENCY = 10


async def run_pipeline(source_types: list[str]) -> dict[str, int]:
    """Run the full ingestion pipeline for the given source types."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise PipelineConfigError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    stats: dict[str, int] = {"fetched": 0, "deduplicated": 0, "stored": 0}

    # Load active sources from DB
    result = supabase.table("sources").select("*").eq("status", "active").execute()
    all_sources = [_to_source(row) for row in result.data]
    sources_map = {s.id: s for s in all_sources}

    # Filter sources by requested fetcher types
    sources_to_fetch = _filter_sources(all_sources, source_types)
    logger.info("Processing %d sources", len(sources_to_fetch))

    # Fetch existing URLs for dedup (limited to last 30 days)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    url_result = (
        supabase.table("articles")
        .select("url")
        .gte("published_at", cutoff)
        .execute()
    )
    existing_urls = {row["url"] for row in url_result.data}

    all_normalized: list[NormalizedArticle] = []

    # Fetch from all sources concurrently
    semaphore = asyncio.Semaphore(_FETCH_CONCURRENCY)

    async def _fetch_one(source: Source) -> list[NormalizedArticle]:
        async with semaphore:
            fetcher_key = _get_fetcher_key(source)
            fetcher = FETCHER_MAP.get(fetcher_key)
            if not fetcher:
                logger.warning("No fetcher for source %s (platform=%s)", source.name, source.platform)
                return []
            raw_articles = await fetcher.safe_fetch(source)
            if len(raw_articles) > MAX_ARTICLES_PER_SOURCE:
                logger.info(
                    "Capping %s from %d to %d articles",
                    source.name,
                    len(raw_articles),
                    MAX_ARTICLES_PER_SOURCE,
                )
                raw_articles = raw_articles[:MAX_ARTICLES_PER_SOURCE]
            return normalize(raw_articles, source)

    results = await asyncio.gather(*[_fetch_one(s) for s in sources_to_fetch])
    for batch in results:
        stats["fetched"] += len(batch)
        all_normalized.extend(batch)

    # Deduplicate
    unique = deduplicate(all_normalized, existing_urls)
    stats["deduplicated"] = stats["fetched"] - len(unique)

    # Tag
    tagged = tag_articles(unique)

    # Build author reputation from existing high-scoring papers
    paper_result = (
        supabase.table("articles")
        .select("engagement_score, engagement_metrics")
        .in_("content_type", ["paper"])
        .gte("engagement_score", 5.0)
        .limit(500)
        .execute()
    )
    reputable_authors = build_author_reputation(paper_result.data, score_threshold=5.0)
    if reputable_authors:
        logger.info("Author reputation: %d reputable authors from DB", len(reputable_authors))

    # Score
    scored = score_articles(tagged, sources_map, reputable_authors=reputable_authors)

    # Enforce GitHub diversity cap (max 30% of total)
    scored = _enforce_github_cap(scored)

    # Store in batches
    stored_count = 0
    for i in range(0, len(scored), BATCH_UPSERT_SIZE):
        batch = scored[i : i + BATCH_UPSERT_SIZE]
        rows = [_to_row(a) for a in batch]
        supabase.table("articles").upsert(rows, on_conflict="url").execute()
        stored_count += len(batch)

    stats["stored"] = stored_count

    # Update last_fetched on processed sources
    now = datetime.now(timezone.utc).isoformat()
    for source in sources_to_fetch:
        supabase.table("sources").update({"last_fetched": now}).eq("id", source.id).execute()

    logger.info(
        "Pipeline complete: fetched=%d, deduplicated=%d, stored=%d",
        stats["fetched"],
        stats["deduplicated"],
        stats["stored"],
    )
    return stats


def _filter_sources(sources: list[Source], source_types: list[str]) -> list[Source]:
    """Filter sources by which fetchers were requested."""
    if "all" in source_types:
        return [s for s in sources if _get_fetcher_key(s) in FETCHER_MAP]

    result: list[Source] = []
    for source in sources:
        fetcher_key = _get_fetcher_key(source)
        if fetcher_key in source_types:
            result.append(source)
    return result


def _get_fetcher_key(source: Source) -> str:
    """Determine which fetcher to use for a source."""
    if source.type == "rss":
        return "rss"
    return PLATFORM_TO_FETCHER.get(source.platform, source.type)


def _to_source(row: dict) -> Source:
    return Source(
        id=row["id"],
        name=row["name"],
        url=row["url"],
        category=row["category"],
        type=row["type"],
        status=row["status"],
        platform=row["platform"],
        fetch_frequency=row["fetch_frequency"],
        reliability_score=float(row.get("reliability_score", 3.0)),
        notes=row.get("notes"),
    )


def _to_row(article: NormalizedArticle) -> dict:
    return {
        "title": article.title,
        "url": article.url,
        "source_id": article.source_id,
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "summary_snippet": article.summary_snippet,
        "content_type": article.content_type,
        "platform": article.platform,
        "topic_tags": article.topic_tags,
        "engagement_score": article.engagement_score,
        "engagement_metrics": article.engagement_metrics,
        "recommendation_reason": article.recommendation_reason,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Pulse ingestion pipeline")
    parser.add_argument(
        "--sources",
        type=str,
        default="all",
        help="Comma-separated source types: hackernews,rss,reddit,all",
    )
    args = parser.parse_args()
    source_types = [s.strip() for s in args.sources.split(",")]
    try:
        asyncio.run(run_pipeline(source_types))
    except PipelineConfigError as exc:
        logger.error("%s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
