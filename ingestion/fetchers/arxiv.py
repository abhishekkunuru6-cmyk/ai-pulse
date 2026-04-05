"""ArXiv fetcher using the ArXiv Atom API (free, no auth).

API docs: https://info.arxiv.org/help/api/basics.html
Each source URL is expected to be like: https://arxiv.org/list/cs.AI
The category (e.g. cs.AI) is extracted and used to query the API.

After fetching from ArXiv, papers are enriched with citation data from
Semantic Scholar's batch API (free, no auth) to provide engagement metrics.
"""

from __future__ import annotations

import asyncio
import re
import xml.etree.ElementTree as ET
from datetime import datetime

import httpx

from ingestion.config.settings import MAX_ARTICLES_PER_FETCH
from ingestion.fetchers.base import BaseFetcher, logger
from ingestion.models import RawArticle, Source

ARXIV_API_URL = "https://export.arxiv.org/api/query"
ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"
_CATEGORY_RE = re.compile(r"(?:list|abs|rss)/([a-zA-Z\-]+\.[A-Za-z]{2,4})")

# Semantic Scholar enrichment
S2_BATCH_URL = "https://api.semanticscholar.org/graph/v1/paper/batch"
S2_FIELDS = "citationCount,influentialCitationCount,tldr"
S2_BATCH_SIZE = 400


def _extract_category(url: str) -> str | None:
    """Extract the ArXiv category from a source URL.

    Supports multiple URL formats:
    - https://arxiv.org/list/cs.AI
    - http://rss.arxiv.org/rss/cs.AI
    - https://arxiv.org/abs/cs.AI
    """
    match = _CATEGORY_RE.search(url)
    return match.group(1) if match else None


def _parse_datetime(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _text(element: ET.Element | None) -> str:
    """Safely extract text content from an XML element."""
    if element is None:
        return ""
    return (element.text or "").strip()


class ArXivFetcher(BaseFetcher):
    """Fetches recent papers from ArXiv via the Atom API."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        category = _extract_category(source.url)
        if not category:
            logger.warning("Could not extract ArXiv category from %s", source.url)
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                ARXIV_API_URL,
                params={
                    "search_query": f"cat:{category}",
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                    "start": 0,
                    "max_results": MAX_ARTICLES_PER_FETCH,
                },
            )
            response.raise_for_status()

        root = ET.fromstring(response.text)
        articles: list[RawArticle] = []

        for entry in root.findall(f"{ATOM_NS}entry"):
            title = _text(entry.find(f"{ATOM_NS}title"))
            if not title:
                continue

            # Prefer the abstract page link
            paper_url = ""
            for link in entry.findall(f"{ATOM_NS}link"):
                if link.get("type") == "text/html":
                    paper_url = link.get("href", "")
                    break
            if not paper_url:
                # Fallback to the id (which is the abs URL)
                paper_url = _text(entry.find(f"{ATOM_NS}id"))

            summary = _text(entry.find(f"{ATOM_NS}summary"))
            published = _parse_datetime(_text(entry.find(f"{ATOM_NS}published")))

            # Extract author names
            authors = [
                _text(author.find(f"{ATOM_NS}name"))
                for author in entry.findall(f"{ATOM_NS}author")
            ]

            # Extract primary and secondary categories
            categories = [
                cat.get("term", "")
                for cat in entry.findall(f"{ARXIV_NS}primary_category")
            ]
            categories.extend(
                cat.get("term", "")
                for cat in entry.findall(f"{ATOM_NS}category")
                if cat.get("term", "") not in categories
            )

            articles.append(
                RawArticle(
                    title=_clean_title(title),
                    url=paper_url,
                    published_at=published,
                    summary_snippet=_truncate(summary, 500),
                    engagement_metrics={"category": category},
                    extra={
                        "authors": authors[:5],  # Cap to avoid bloat
                        "categories": categories[:5],
                        "arxiv_id": _extract_arxiv_id(paper_url),
                    },
                )
            )

        # Enrich with Semantic Scholar citation data
        articles = await _enrich_with_s2(articles)

        return articles


def _clean_title(title: str) -> str:
    """Collapse whitespace in ArXiv titles (they often span multiple lines)."""
    return re.sub(r"\s+", " ", title).strip()


def _truncate(text: str, max_len: int) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3] + "..."


def _extract_arxiv_id(url: str) -> str:
    """Extract the ArXiv paper ID from a URL like http://arxiv.org/abs/2301.12345v1."""
    match = re.search(r"(\d{4}\.\d{4,5})(v\d+)?", url)
    return match.group(0) if match else ""


# --- Semantic Scholar enrichment ---


async def _enrich_with_s2(articles: list[RawArticle]) -> list[RawArticle]:
    """Look up each paper on Semantic Scholar to get citation data and TLDR.

    Returns new list of RawArticle with enriched engagement_metrics.
    Failures are silently skipped — articles keep their original data.
    """
    # Build arxiv_id → index mapping
    id_to_indices: dict[str, list[int]] = {}
    for i, article in enumerate(articles):
        arxiv_id = article.extra.get("arxiv_id", "")
        if arxiv_id:
            # Strip version suffix for S2 lookup (e.g. 2401.12345v1 → 2401.12345)
            clean_id = re.sub(r"v\d+$", "", str(arxiv_id))
            id_to_indices.setdefault(clean_id, []).append(i)

    if not id_to_indices:
        return articles

    all_ids = list(id_to_indices.keys())
    s2_results: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=60) as client:
        for batch_start in range(0, len(all_ids), S2_BATCH_SIZE):
            batch_ids = all_ids[batch_start : batch_start + S2_BATCH_SIZE]
            batch_results = await _fetch_s2_batch(client, batch_ids)
            s2_results.update(batch_results)

            # Rate limit between batches
            if batch_start + S2_BATCH_SIZE < len(all_ids):
                await asyncio.sleep(2)

    if not s2_results:
        logger.info("S2 enrichment: no results returned")
        return articles

    logger.info("S2 enrichment: got data for %d / %d papers", len(s2_results), len(all_ids))

    # Build enriched article list (immutable — create new objects)
    enriched = list(articles)
    for arxiv_id, data in s2_results.items():
        for idx in id_to_indices.get(arxiv_id, []):
            original = enriched[idx]
            new_metrics = {**original.engagement_metrics, **data["metrics"]}
            new_snippet = original.summary_snippet
            # Prefer S2 TLDR over ArXiv abstract if available
            if data.get("tldr") and (not new_snippet or len(data["tldr"]) > 20):
                new_snippet = data["tldr"]
            enriched[idx] = RawArticle(
                title=original.title,
                url=original.url,
                published_at=original.published_at,
                summary_snippet=new_snippet,
                engagement_metrics=new_metrics,
                extra=original.extra,
            )

    return enriched


async def _fetch_s2_batch(
    client: httpx.AsyncClient,
    arxiv_ids: list[str],
) -> dict[str, dict]:
    """Fetch citation data for a batch of ArXiv IDs from Semantic Scholar."""
    ids = [f"ARXIV:{aid}" for aid in arxiv_ids]

    for attempt in range(3):
        try:
            response = await client.post(
                S2_BATCH_URL,
                params={"fields": S2_FIELDS},
                json={"ids": ids},
            )
            if response.status_code == 429:
                wait = 10 * (attempt + 1)
                logger.warning("S2 rate limited, waiting %ds...", wait)
                await asyncio.sleep(wait)
                continue
            response.raise_for_status()
            break
        except httpx.HTTPStatusError as exc:
            logger.warning("S2 batch API error (attempt %d): %s", attempt + 1, exc)
            if attempt < 2:
                await asyncio.sleep(5)
            else:
                return {}
    else:
        return {}

    results: dict[str, dict] = {}
    for i, paper in enumerate(response.json()):
        if paper is None:
            continue
        tldr_obj = paper.get("tldr")
        tldr_text = tldr_obj.get("text") if isinstance(tldr_obj, dict) else None
        results[arxiv_ids[i]] = {
            "metrics": {
                "citations": paper.get("citationCount", 0) or 0,
                "influential_citations": paper.get("influentialCitationCount", 0) or 0,
            },
            "tldr": tldr_text,
        }

    return results
