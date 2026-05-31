"""GitHub Trending fetcher using the GitHub REST API search endpoint.

Authenticates with GH_TOKEN when available (5000 req/hr).
Falls back to unauthenticated (10 req/min) with inter-request delays.
Queries multiple AI/ML keywords and scores results by stars, forks, and recency.
"""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone

import httpx

from ingestion.config.settings import GITHUB_PAT, MAX_ARTICLES_PER_FETCH
from ingestion.fetchers.base import BaseFetcher
from ingestion.models import RawArticle, Source

logger = logging.getLogger(__name__)

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"

AI_SEARCH_QUERIES = [
    "machine learning",
    "LLM",
    "large language model",
    "AI agent",
    "deep learning",
    "transformer model",
    "diffusion model",
    "neural network",
]

# Limit queries per fetch to stay within the 10 req/min unauthenticated cap.
_MAX_QUERIES_PER_FETCH = 5

_RESULTS_PER_QUERY = 30

# Weights for the composite relevance score.
_STAR_WEIGHT = 1.0
_FORK_WEIGHT = 2.0
_RECENCY_HALF_LIFE_DAYS = 14


def _compute_score(stars: int, forks: int, created_at: datetime | None) -> float:
    """Compute a composite score from stars, forks, and recency.

    Recency uses an exponential decay with a configurable half-life so that
    recently created/updated repos are boosted.
    """
    base = (stars * _STAR_WEIGHT) + (forks * _FORK_WEIGHT)

    recency_multiplier = 1.0
    if created_at is not None:
        age_days = max(
            (datetime.now(timezone.utc) - created_at).total_seconds() / 86400,
            0,
        )
        recency_multiplier = math.pow(0.5, age_days / _RECENCY_HALF_LIFE_DAYS)

    return base * (1.0 + recency_multiplier)


def _parse_iso_datetime(value: str | None) -> datetime | None:
    """Safely parse an ISO-8601 datetime string from the GitHub API."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        logger.warning("Failed to parse datetime: %s", value)
        return None


def _build_search_params(query: str, pushed_after: str) -> dict[str, str | int]:
    """Build query parameters for the GitHub search endpoint."""
    return {
        "q": f"{query} pushed:>{pushed_after}",
        "sort": "stars",
        "order": "desc",
        "per_page": _RESULTS_PER_QUERY,
    }


def _repo_to_raw_article(repo: dict) -> RawArticle:
    """Convert a single GitHub API repo object to a RawArticle."""
    created_at = _parse_iso_datetime(repo.get("created_at"))
    updated_at = _parse_iso_datetime(repo.get("updated_at"))
    stars = repo.get("stargazers_count", 0)
    forks = repo.get("forks_count", 0)

    return RawArticle(
        title=repo.get("full_name", ""),
        url=repo.get("html_url", ""),
        published_at=updated_at or created_at,
        summary_snippet=repo.get("description") or "",
        engagement_metrics={
            "stars": stars,
            "forks": forks,
            "watchers": repo.get("watchers_count", 0),
            "open_issues": repo.get("open_issues_count", 0),
        },
        extra={
            "language": repo.get("language"),
            "created_at": repo.get("created_at"),
            "updated_at": repo.get("updated_at"),
            "topics": repo.get("topics", []),
            "score": _compute_score(stars, forks, created_at),
        },
    )


class GitHubTrendingFetcher(BaseFetcher):
    """Fetches trending AI/ML repositories from GitHub's search API."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        """Fetch AI/ML repos pushed within the last 7 days, sorted by stars."""
        pushed_after = (
            datetime.now(timezone.utc) - timedelta(days=7)
        ).strftime("%Y-%m-%d")

        articles: list[RawArticle] = []

        headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
        if GITHUB_PAT:
            headers["Authorization"] = f"Bearer {GITHUB_PAT}"
        else:
            logger.warning("GH_TOKEN not set — using unauthenticated GitHub API (10 req/min)")

        # Unauthenticated requests are capped at 10/min; add a delay between queries
        # when running without auth to stay within the limit.
        inter_request_delay = 0.0 if GITHUB_PAT else 7.0

        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            queries = AI_SEARCH_QUERIES[:_MAX_QUERIES_PER_FETCH]

            for i, query in enumerate(queries):
                if i > 0 and inter_request_delay:
                    await asyncio.sleep(inter_request_delay)

                params = _build_search_params(query, pushed_after)
                response = await client.get(GITHUB_SEARCH_URL, params=params)
                response.raise_for_status()
                data = response.json()

                for repo in data.get("items", []):
                    articles.append(_repo_to_raw_article(repo))

        # Deduplicate by URL
        seen_urls: set[str] = set()
        unique: list[RawArticle] = []
        for article in articles:
            if article.url not in seen_urls:
                seen_urls.add(article.url)
                unique.append(article)

        # Sort by composite score (highest first) and cap
        unique.sort(
            key=lambda a: a.extra.get("score", 0),  # type: ignore[arg-type]
            reverse=True,
        )

        return unique[:MAX_ARTICLES_PER_FETCH]
