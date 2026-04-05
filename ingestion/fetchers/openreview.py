"""OpenReview fetcher.

Note: As of 2026, OpenReview requires authentication for API access.
This fetcher attempts to use their API with an optional API key.
Set OPENREVIEW_API_KEY in environment to enable.

Without an API key, this fetcher returns an empty list and logs a warning.
To obtain a key, register at https://openreview.net and create an API token.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx

from ingestion.config.settings import MAX_ARTICLES_PER_FETCH
from ingestion.fetchers.base import BaseFetcher, logger
from ingestion.models import RawArticle, Source

OPENREVIEW_API_URL = "https://api2.openreview.net"
OPENREVIEW_FORUM_URL = "https://openreview.net/forum?id="


class OpenReviewFetcher(BaseFetcher):
    """Fetches recent paper submissions from OpenReview (requires API key)."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        api_key = os.environ.get("OPENREVIEW_API_KEY", "")
        if not api_key:
            logger.info(
                "OpenReview API key not set (OPENREVIEW_API_KEY). "
                "Skipping OpenReview fetch. Register at openreview.net for a free key."
            )
            return []

        headers = {
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ai-pulse/1.0",
        }

        articles: list[RawArticle] = []

        async with httpx.AsyncClient(timeout=30) as client:
            # Fetch recent submissions from top venues
            for venue in ["ICLR.cc/2025/Conference", "NeurIPS.cc/2025/Conference", "ICML.cc/2025/Conference"]:
                batch = await _fetch_venue_notes(client, headers, venue)
                articles.extend(batch)

        # Sort by date descending and cap
        articles.sort(
            key=lambda a: a.published_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        return articles[:MAX_ARTICLES_PER_FETCH]


async def _fetch_venue_notes(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    venue: str,
) -> list[RawArticle]:
    """Fetch recent submissions for a venue."""
    try:
        response = await client.get(
            f"{OPENREVIEW_API_URL}/notes",
            headers=headers,
            params={
                "domain": venue,
                "limit": 20,
            },
        )
        if response.status_code in (401, 403):
            logger.warning("OpenReview auth failed for %s — check API key", venue)
            return []
        if response.status_code == 429:
            logger.warning("OpenReview rate-limited for venue: %s", venue)
            return []
        response.raise_for_status()
    except httpx.HTTPStatusError:
        logger.warning("OpenReview API error for venue: %s", venue)
        return []

    data = response.json()
    articles: list[RawArticle] = []

    for note in data.get("notes", []):
        content = note.get("content", {})

        # Extract title
        title_field = content.get("title", {})
        title = title_field.get("value", "") if isinstance(title_field, dict) else str(title_field)
        title = title.strip()
        if not title:
            continue

        # Build URL
        forum_id = note.get("forum", note.get("id", ""))
        if not forum_id:
            continue
        paper_url = f"{OPENREVIEW_FORUM_URL}{forum_id}"

        # Extract abstract
        abstract_field = content.get("abstract", {})
        abstract = abstract_field.get("value", "") if isinstance(abstract_field, dict) else str(abstract_field)

        # Extract authors
        authors_field = content.get("authors", {})
        authors = authors_field.get("value", []) if isinstance(authors_field, dict) else []

        # Parse creation date
        cdate = note.get("cdate") or note.get("tcdate")
        pub_date = _parse_timestamp(cdate)

        articles.append(
            RawArticle(
                title=title,
                url=paper_url,
                published_at=pub_date,
                summary_snippet=_truncate(abstract, 400),
                engagement_metrics={"venue": venue.split("/")[0]},
                extra={
                    "forum_id": forum_id,
                    "authors": [str(a) for a in (authors or [])[:5]],
                    "venue": venue,
                },
            )
        )

    return articles


def _parse_timestamp(ts: int | float | None) -> datetime | None:
    """Convert OpenReview millisecond timestamp to datetime."""
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None


def _truncate(text: str, max_len: int) -> str | None:
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
