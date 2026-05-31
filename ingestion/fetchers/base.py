"""Abstract base fetcher that all source fetchers must implement."""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod

import httpx

from ingestion.models import RawArticle, Source

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3
_RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in _RETRYABLE_STATUS_CODES
    return False


class BaseFetcher(ABC):
    """Base class for all content source fetchers."""

    @abstractmethod
    async def fetch(self, source: Source) -> list[RawArticle]:
        """Fetch raw articles from a source.

        Must handle errors gracefully — return an empty list on failure,
        never crash the pipeline.
        """

    async def safe_fetch(self, source: Source) -> list[RawArticle]:
        """Wrapper that retries on transient errors and logs failures."""
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                articles = await self.fetch(source)
                logger.info("Fetched %d articles from %s", len(articles), source.name)
                return articles
            except Exception as exc:
                if _is_retryable(exc) and attempt < _MAX_ATTEMPTS:
                    wait = 2 ** attempt
                    logger.warning(
                        "Transient error from %s (attempt %d/%d), retrying in %ds: %s",
                        source.name,
                        attempt,
                        _MAX_ATTEMPTS,
                        wait,
                        exc,
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.exception(
                        "Failed to fetch from %s after %d attempt(s)",
                        source.name,
                        attempt,
                    )
                    return []
        return []
