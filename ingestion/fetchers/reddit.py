"""Reddit fetcher — uses OAuth when credentials are available, otherwise falls back to the public JSON API."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

import httpx

from ingestion.config.settings import (
    MAX_ARTICLES_PER_FETCH,
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT,
)
from ingestion.fetchers.base import BaseFetcher
from ingestion.models import RawArticle, Source

logger = logging.getLogger(__name__)

REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"
REDDIT_PUBLIC_BASE = "https://www.reddit.com"


class RedditFetcher(BaseFetcher):
    """Fetches top posts from tracked subreddits via Reddit API or public JSON."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        subreddit = _extract_subreddit(source.url)
        if not subreddit:
            return []

        # Try OAuth first, fall back to public JSON API
        token = await _get_access_token()
        if token:
            return await self._fetch_oauth(subreddit, token)

        logger.info("No Reddit API credentials — using public JSON API for r/%s", subreddit)
        return await self._fetch_public(subreddit)

    async def _fetch_oauth(self, subreddit: str, token: str) -> list[RawArticle]:
        """Fetch via authenticated OAuth endpoint (higher rate limits)."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{REDDIT_API_BASE}/r/{subreddit}/hot",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": REDDIT_USER_AGENT,
                },
                params={"limit": MAX_ARTICLES_PER_FETCH},
            )
            response.raise_for_status()

        return _parse_listing(response.json(), subreddit)

    async def _fetch_public(self, subreddit: str) -> list[RawArticle]:
        """Fetch via public JSON endpoint (no auth needed, lower rate limits)."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{REDDIT_PUBLIC_BASE}/r/{subreddit}/hot.json",
                headers={"User-Agent": REDDIT_USER_AGENT},
                params={"limit": MAX_ARTICLES_PER_FETCH, "raw_json": 1},
            )
            response.raise_for_status()

        return _parse_listing(response.json(), subreddit)


def _parse_listing(data: dict, subreddit: str) -> list[RawArticle]:
    """Parse a Reddit listing response into RawArticle objects."""
    articles: list[RawArticle] = []

    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        if post.get("stickied"):
            continue

        url = post.get("url", "")
        if post.get("is_self"):
            url = f"https://reddit.com{post.get('permalink', '')}"

        created_utc = post.get("created_utc")
        published_at = (
            datetime.fromtimestamp(created_utc, tz=timezone.utc)
            if created_utc
            else None
        )

        articles.append(
            RawArticle(
                title=post.get("title", ""),
                url=url,
                published_at=published_at,
                summary_snippet=_truncate(post.get("selftext", ""), 300),
                engagement_metrics={
                    "upvotes": post.get("ups", 0),
                    "comments": post.get("num_comments", 0),
                    "upvote_ratio": post.get("upvote_ratio", 0),
                    "subreddit": subreddit,
                },
                extra={
                    "reddit_id": post.get("id"),
                    "flair": post.get("link_flair_text"),
                },
            )
        )

    return articles


async def _get_access_token() -> str | None:
    """Get a Reddit OAuth access token using client credentials."""
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                REDDIT_TOKEN_URL,
                auth=(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET),
                data={"grant_type": "client_credentials"},
                headers={"User-Agent": REDDIT_USER_AGENT},
            )
            response.raise_for_status()
            return response.json().get("access_token")
    except httpx.HTTPError:
        logger.warning("Reddit OAuth failed — will fall back to public API")
        return None


_SUBREDDIT_RE = re.compile(r"^[A-Za-z0-9_]{2,21}$")


def _extract_subreddit(url: str) -> str | None:
    """Extract and validate subreddit name from a Reddit URL."""
    parts = url.rstrip("/").split("/")
    for i, part in enumerate(parts):
        if part == "r" and i + 1 < len(parts):
            candidate = parts[i + 1]
            if _SUBREDDIT_RE.match(candidate):
                return candidate
    return None


def _truncate(text: str, max_len: int) -> str | None:
    """Truncate text to max_len chars, or return None if empty."""
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
