"""Semantic Scholar fetcher using the public API (free, no auth required).

API docs: https://api.semanticscholar.org/api-docs/
Uses the /paper/search endpoint to find recent AI/ML papers with TLDRs.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ingestion.config.settings import MAX_ARTICLES_PER_FETCH, SEMANTIC_SCHOLAR_API_KEY
from ingestion.fetchers.base import BaseFetcher, logger
from ingestion.models import RawArticle, Source

S2_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
S2_PAPER_URL = "https://www.semanticscholar.org/paper"

# AI/ML-focused search queries rotated per fetch
SEARCH_QUERIES = [
    "large language model",
    "deep learning",
    "transformer neural network",
    "reinforcement learning",
    "computer vision",
    "AI alignment safety",
    "multimodal model",
    "diffusion model",
]

FIELDS = "title,url,abstract,year,citationCount,influentialCitationCount,authors,tldr,publicationDate,externalIds"


class SemanticScholarFetcher(BaseFetcher):
    """Fetches recent AI/ML papers from Semantic Scholar."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        articles: list[RawArticle] = []
        seen_urls: set[str] = set()

        async with httpx.AsyncClient(timeout=30) as client:
            # Query top 3 search terms with delay to avoid rate limits
            import asyncio
            for i, query in enumerate(SEARCH_QUERIES[:3]):
                if i > 0:
                    await asyncio.sleep(3.0)  # Respect S2 rate limits (100 req/5min)
                batch = await _search_papers(client, query)
                for article in batch:
                    if article.url not in seen_urls:
                        seen_urls.add(article.url)
                        articles.append(article)

        return articles[:MAX_ARTICLES_PER_FETCH]


async def _search_papers(
    client: httpx.AsyncClient, query: str
) -> list[RawArticle]:
    """Search for papers matching a query, sorted by recency."""
    headers = {"x-api-key": SEMANTIC_SCHOLAR_API_KEY} if SEMANTIC_SCHOLAR_API_KEY else {}
    try:
        response = await client.get(
            S2_API_URL,
            params={
                "query": query,
                "limit": 20,
                "fields": FIELDS,
                "sort": "publicationDate:desc",
                "year": f"{datetime.now(timezone.utc).year}",
            },
            headers=headers,
        )
        # S2 API returns 429 on rate limit — handle gracefully
        if response.status_code == 429:
            logger.warning("Semantic Scholar rate-limited for query: %s", query)
            return []
        response.raise_for_status()
    except httpx.HTTPStatusError:
        logger.warning("Semantic Scholar API error for query: %s", query)
        return []

    data = response.json()
    articles: list[RawArticle] = []

    for paper in data.get("data", []):
        title = paper.get("title", "").strip()
        if not title:
            continue

        paper_url = paper.get("url", "")
        if not paper_url:
            paper_id = paper.get("paperId", "")
            if paper_id:
                paper_url = f"{S2_PAPER_URL}/{paper_id}"
            else:
                continue

        # Prefer TLDR over abstract for snippet
        tldr = paper.get("tldr")
        snippet = tldr.get("text") if isinstance(tldr, dict) else None
        if not snippet:
            abstract = paper.get("abstract", "")
            snippet = _truncate(abstract, 400) if abstract else None

        pub_date = _parse_date(paper.get("publicationDate"))
        authors = [
            a.get("name", "")
            for a in (paper.get("authors") or [])[:5]
        ]
        external_ids = paper.get("externalIds") or {}

        articles.append(
            RawArticle(
                title=title,
                url=paper_url,
                published_at=pub_date,
                summary_snippet=snippet,
                engagement_metrics={
                    "citations": paper.get("citationCount", 0),
                    "influential_citations": paper.get("influentialCitationCount", 0),
                },
                extra={
                    "authors": authors,
                    "arxiv_id": external_ids.get("ArXiv"),
                    "doi": external_ids.get("DOI"),
                    "year": paper.get("year"),
                },
            )
        )

    return articles


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _truncate(text: str, max_len: int) -> str | None:
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
