"""Abstract base fetcher that all source fetchers must implement."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from ingestion.models import RawArticle, Source

logger = logging.getLogger(__name__)


class BaseFetcher(ABC):
    """Base class for all content source fetchers."""

    @abstractmethod
    async def fetch(self, source: Source) -> list[RawArticle]:
        """Fetch raw articles from a source.

        Must handle errors gracefully — return an empty list on failure,
        never crash the pipeline.
        """

    async def safe_fetch(self, source: Source) -> list[RawArticle]:
        """Wrapper that catches exceptions and logs them."""
        try:
            articles = await self.fetch(source)
            logger.info(
                "Fetched %d articles from %s", len(articles), source.name
            )
            return articles
        except Exception:
            logger.exception("Failed to fetch from %s", source.name)
            return []
