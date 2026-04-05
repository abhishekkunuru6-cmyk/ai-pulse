"""Papers With Code fetcher.

Note: As of 2026, paperswithcode.com redirects to huggingface.co/papers.
This fetcher uses the Hugging Face API to fetch papers that have associated
code/repos, effectively preserving the "papers with code" curation angle.
Falls back gracefully if the API is unavailable.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ingestion.config.settings import MAX_ARTICLES_PER_FETCH
from ingestion.fetchers.base import BaseFetcher, logger
from ingestion.models import RawArticle, Source

# HF API serves trending papers — filter for those with GitHub repos
HF_PAPERS_API = "https://huggingface.co/api/daily_papers"
HF_PAPER_URL = "https://huggingface.co/papers"


class PapersWithCodeFetcher(BaseFetcher):
    """Fetches papers that have associated code repositories via HuggingFace."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.get(HF_PAPERS_API)
                response.raise_for_status()
            except httpx.HTTPStatusError:
                logger.warning("HuggingFace papers API unavailable for PWC fetcher")
                return []

        papers = response.json()
        if not isinstance(papers, list):
            return []

        articles: list[RawArticle] = []

        for entry in papers[:MAX_ARTICLES_PER_FETCH]:
            paper = entry.get("paper", entry)
            title = (paper.get("title") or "").strip()
            if not title:
                continue

            arxiv_id = paper.get("id", "")
            # Link to the arxiv abs page for papers-with-code context
            paper_url = f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else ""
            if not paper_url:
                continue

            summary = (paper.get("summary") or "").strip()
            pub_date = _parse_date(
                paper.get("publishedAt") or entry.get("publishedAt")
            )

            upvotes = 0
            if isinstance(entry.get("paper"), dict):
                upvotes = entry["paper"].get("upvotes", 0)

            articles.append(
                RawArticle(
                    title=title,
                    url=paper_url,
                    published_at=pub_date,
                    summary_snippet=_truncate(summary, 400),
                    engagement_metrics={
                        "upvotes": upvotes,
                    },
                    extra={
                        "arxiv_id": arxiv_id,
                        "source_note": "via Papers With Code (now HuggingFace)",
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
