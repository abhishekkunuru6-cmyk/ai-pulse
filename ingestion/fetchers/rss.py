"""Generic RSS/Atom feed fetcher."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import mktime
from urllib.parse import urlparse

import feedparser
import httpx

from ingestion.fetchers.base import BaseFetcher
from ingestion.models import RawArticle, Source

logger = logging.getLogger(__name__)

_BLOCKED_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0", "[::1]"})


def _is_safe_url(url: str) -> bool:
    """Reject URLs that target internal/private network addresses."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = (parsed.hostname or "").lower()
    if hostname in _BLOCKED_HOSTS or hostname.startswith("169.254."):
        return False
    return True


class RSSFetcher(BaseFetcher):
    """Fetches articles from any RSS or Atom feed."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        if not _is_safe_url(source.url):
            logger.warning("Blocked unsafe URL: %s", source.url)
            return []

        # feedparser is synchronous, so we fetch the raw XML with httpx first
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(source.url, follow_redirects=True)
            response.raise_for_status()

        feed = feedparser.parse(response.text)
        articles: list[RawArticle] = []

        for entry in feed.entries:
            url = entry.get("link", "")
            if not url:
                continue

            published_at = _parse_feed_date(entry)

            summary = entry.get("summary", "") or entry.get("description", "")
            # Truncate summary to ~300 chars
            if len(summary) > 300:
                summary = summary[:297] + "..."

            articles.append(
                RawArticle(
                    title=entry.get("title", "Untitled"),
                    url=url,
                    published_at=published_at,
                    summary_snippet=summary or None,
                    engagement_metrics={},
                    extra={"feed_id": entry.get("id", url)},
                )
            )

        return articles


def _parse_feed_date(entry: dict) -> datetime | None:
    """Try multiple date fields and formats from a feed entry."""
    for field in ("published_parsed", "updated_parsed"):
        parsed = entry.get(field)
        if parsed:
            try:
                return datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
            except (ValueError, OverflowError, OSError):
                continue

    for field in ("published", "updated"):
        date_str = entry.get(field)
        if date_str:
            try:
                return parsedate_to_datetime(date_str)
            except (ValueError, TypeError):
                pass
            try:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

    return None
