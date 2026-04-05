"""Hacker News fetcher using the Algolia API (free, no auth)."""

from __future__ import annotations

from datetime import datetime

import httpx

from ingestion.config.settings import MAX_ARTICLES_PER_FETCH
from ingestion.fetchers.base import BaseFetcher
from ingestion.models import RawArticle, Source

HN_ALGOLIA_URL = "https://hn.algolia.com/api/v1/search"
AI_KEYWORDS = [
    "AI",
    "artificial intelligence",
    "machine learning",
    "LLM",
    "GPT",
    "deep learning",
    "neural network",
    "transformer",
    "diffusion",
    "language model",
    "OpenAI",
    "Anthropic",
    "Claude",
    "Gemini",
    "Llama",
    "Mistral",
]


class HackerNewsFetcher(BaseFetcher):
    """Fetches AI-related posts from Hacker News via the Algolia API."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        articles: list[RawArticle] = []

        async with httpx.AsyncClient(timeout=30) as client:
            for keyword in AI_KEYWORDS[:5]:  # Top 5 keywords to stay within reason
                response = await client.get(
                    HN_ALGOLIA_URL,
                    params={
                        "query": keyword,
                        "tags": "story",
                        "numericFilters": "points>10",
                        "hitsPerPage": MAX_ARTICLES_PER_FETCH,
                    },
                )
                response.raise_for_status()
                data = response.json()

                for hit in data.get("hits", []):
                    url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}"
                    created_at = hit.get("created_at")

                    articles.append(
                        RawArticle(
                            title=hit.get("title", ""),
                            url=url,
                            published_at=datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                            if created_at
                            else None,
                            summary_snippet=None,
                            engagement_metrics={
                                "points": hit.get("points", 0),
                                "comments": hit.get("num_comments", 0),
                            },
                            extra={"hn_id": hit.get("objectID")},
                        )
                    )

        # Deduplicate by URL within this fetch
        seen_urls: set[str] = set()
        unique: list[RawArticle] = []
        for article in articles:
            if article.url not in seen_urls:
                seen_urls.add(article.url)
                unique.append(article)

        return unique
