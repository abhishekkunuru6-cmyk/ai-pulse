"""Deduplicate articles by URL exact match and fuzzy title matching."""

from __future__ import annotations

import hashlib
import logging

from thefuzz import fuzz

from ingestion.config.settings import DEDUP_FUZZY_THRESHOLD
from ingestion.models import NormalizedArticle

logger = logging.getLogger(__name__)


def deduplicate(
    articles: list[NormalizedArticle],
    existing_urls: set[str] | None = None,
) -> list[NormalizedArticle]:
    """Remove duplicate articles.

    1. Exact URL match against existing_urls (from DB) and within batch.
    2. Fuzzy title match within the batch (threshold=90).
    """
    seen_urls: set[str] = set(existing_urls or set())
    seen_titles: list[str] = []
    unique: list[NormalizedArticle] = []

    for article in articles:
        url_hash = _url_hash(article.url)

        # Skip exact URL duplicates
        if url_hash in seen_urls:
            continue

        # Skip fuzzy title matches
        if _is_fuzzy_duplicate(article.title, seen_titles):
            logger.debug("Fuzzy duplicate skipped: %s", article.title)
            continue

        seen_urls.add(url_hash)
        seen_titles.append(article.title)
        unique.append(article)

    deduped_count = len(articles) - len(unique)
    if deduped_count > 0:
        logger.info("Deduplicated %d articles (kept %d)", deduped_count, len(unique))

    return unique


def _url_hash(url: str) -> str:
    """Normalize and hash a URL for exact matching."""
    normalized = url.lower().rstrip("/").split("?")[0].split("#")[0]
    return hashlib.sha256(normalized.encode()).hexdigest()


def _is_fuzzy_duplicate(title: str, existing_titles: list[str]) -> bool:
    """Check if a title is too similar to any existing title."""
    for existing in existing_titles:
        ratio = fuzz.ratio(title.lower(), existing.lower())
        if ratio >= DEDUP_FUZZY_THRESHOLD:
            return True
    return False
