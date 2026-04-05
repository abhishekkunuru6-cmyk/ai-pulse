"""Hugging Face Daily Papers fetcher using the HF API (free, no auth).

Fetches the daily curated papers list from https://huggingface.co/papers
using their API endpoint.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ingestion.config.settings import MAX_ARTICLES_PER_FETCH
from ingestion.fetchers.base import BaseFetcher, logger
from ingestion.models import RawArticle, Source

HF_PAPERS_API = "https://huggingface.co/api/daily_papers"
HF_PAPER_URL = "https://huggingface.co/papers"


class HuggingFaceFetcher(BaseFetcher):
    """Fetches daily curated ML papers from Hugging Face."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(HF_PAPERS_API)
            response.raise_for_status()

        papers = response.json()
        if not isinstance(papers, list):
            logger.warning("Unexpected HF papers response format")
            return []

        articles: list[RawArticle] = []

        for entry in papers[:MAX_ARTICLES_PER_FETCH]:
            paper = entry.get("paper", entry)
            title = (paper.get("title") or "").strip()
            if not title:
                continue

            arxiv_id = paper.get("id", "")
            paper_url = f"{HF_PAPER_URL}/{arxiv_id}" if arxiv_id else ""
            if not paper_url:
                continue

            summary = (paper.get("summary") or "").strip()
            pub_date = _parse_date(
                paper.get("publishedAt") or entry.get("publishedAt")
            )

            # Extract authors
            authors_list = paper.get("authors", []) or []
            authors = []
            for author in authors_list[:5]:
                if isinstance(author, dict):
                    name = author.get("name", "")
                    if name:
                        authors.append(name)
                elif isinstance(author, str):
                    authors.append(author)

            # Engagement metrics from HF community
            upvotes = 0
            if isinstance(entry.get("paper"), dict):
                upvotes = entry["paper"].get("upvotes", 0) or 0

            num_comments = entry.get("numComments", 0) or 0
            if isinstance(entry.get("paper"), dict):
                num_comments = max(num_comments, entry["paper"].get("numComments", 0) or 0)

            author_count = len(authors_list)

            articles.append(
                RawArticle(
                    title=title,
                    url=paper_url,
                    published_at=pub_date,
                    summary_snippet=_truncate(summary, 500),
                    engagement_metrics={
                        "upvotes": upvotes,
                        "comments": num_comments,
                        "hf_daily_featured": 1,  # Signal: curated by HF editors
                    },
                    extra={
                        "arxiv_id": arxiv_id,
                        "authors": authors,
                        "author_count": author_count,
                    },
                )
            )

        return articles


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        pass
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _truncate(text: str, max_len: int) -> str | None:
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
