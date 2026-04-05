"""Enrich ArXiv articles with citation data from Semantic Scholar.

Uses the S2 batch API to look up papers by ArXiv ID and populate
engagement_metrics with citation counts. Then re-scores all enriched articles.

API docs: https://api.semanticscholar.org/api-docs/
- POST /paper/batch  (up to 500 IDs per request)
- Rate limit: 1 req/sec unauthenticated

Usage:
    PYTHONPATH=. ingestion/.venv/bin/python ingestion/enrich_arxiv.py
"""

from __future__ import annotations

import asyncio
import logging
import re
import sys
import time

import httpx
from supabase import create_client

from ingestion.config.settings import SUPABASE_KEY, SUPABASE_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger(__name__)

S2_BATCH_URL = "https://api.semanticscholar.org/graph/v1/paper/batch"
S2_FIELDS = "citationCount,influentialCitationCount"
BATCH_SIZE = 400  # S2 allows up to 500, use 400 for safety
_ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})")


def _compute_engagement(metrics: dict[str, object]) -> float:
    """Delegate to the real scorer to avoid logic duplication."""
    from ingestion.pipeline.scorer import _normalize_engagement

    return _normalize_engagement(metrics, content_type="paper", platform="arxiv")


async def fetch_s2_batch(
    client: httpx.AsyncClient,
    arxiv_ids: list[str],
) -> dict[str, dict]:
    """Fetch citation data for a batch of ArXiv IDs from Semantic Scholar."""
    # S2 expects IDs in format "ARXIV:2401.12345"
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
                log.warning("Rate limited, waiting %ds...", wait)
                await asyncio.sleep(wait)
                continue

            response.raise_for_status()
            break
        except httpx.HTTPStatusError as e:
            log.warning("S2 API error (attempt %d): %s", attempt + 1, e)
            if attempt < 2:
                await asyncio.sleep(5)
            else:
                return {}

    results: dict[str, dict] = {}
    for i, paper in enumerate(response.json()):
        if paper is None:
            continue
        arxiv_id = arxiv_ids[i]
        results[arxiv_id] = {
            "citations": paper.get("citationCount", 0) or 0,
            "influential_citations": paper.get("influentialCitationCount", 0) or 0,
        }

    return results


async def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Load sources for reliability lookup
    log.info("Loading sources...")
    sources_resp = sb.table("sources").select("id, reliability_score").execute()
    reliability_map: dict[str, float] = {
        s["id"]: float(s.get("reliability_score") or 3.0) for s in sources_resp.data
    }

    # Fetch all ArXiv articles
    log.info("Fetching ArXiv articles...")
    all_articles: list[dict] = []
    offset = 0
    while True:
        resp = (
            sb.table("articles")
            .select("id, url, source_id, engagement_metrics")
            .eq("platform", "arxiv")
            .range(offset, offset + 499)
            .execute()
        )
        rows = resp.data
        if not rows:
            break
        all_articles.extend(rows)
        offset += len(rows)
        if len(rows) < 500:
            break

    log.info("Found %d ArXiv articles", len(all_articles))

    # Extract ArXiv IDs from URLs (e.g. http://arxiv.org/abs/2401.12345v1)
    articles_with_ids: list[tuple[dict, str]] = []
    for article in all_articles:
        match = _ARXIV_ID_RE.search(article.get("url", ""))
        if match:
            articles_with_ids.append((article, match.group(1)))

    log.info("%d articles have ArXiv IDs", len(articles_with_ids))

    if not articles_with_ids:
        log.info("No articles to enrich")
        return

    # Batch query Semantic Scholar
    enriched_count = 0
    updated_count = 0

    async with httpx.AsyncClient(timeout=60) as client:
        for batch_start in range(0, len(articles_with_ids), BATCH_SIZE):
            batch = articles_with_ids[batch_start : batch_start + BATCH_SIZE]
            arxiv_ids = [aid for _, aid in batch]

            log.info(
                "Querying S2 for batch %d–%d (%d IDs)...",
                batch_start,
                batch_start + len(batch),
                len(arxiv_ids),
            )

            s2_data = await fetch_s2_batch(client, arxiv_ids)
            enriched_count += len(s2_data)

            log.info("  Got citation data for %d / %d papers", len(s2_data), len(batch))

            # Update each article
            for article, arxiv_id in batch:
                citation_data = s2_data.get(arxiv_id)
                if not citation_data:
                    continue

                # Merge citation data into existing engagement_metrics
                metrics = dict(article.get("engagement_metrics") or {})
                metrics["citations"] = citation_data["citations"]
                metrics["influential_citations"] = citation_data["influential_citations"]

                # Compute new score
                reliability = reliability_map.get(article["source_id"], 3.0)
                engagement = _compute_engagement(metrics)
                new_score = round(reliability * engagement, 2)

                # Update in DB
                sb.table("articles").update(
                    {
                        "engagement_metrics": metrics,
                        "engagement_score": new_score,
                    }
                ).eq("id", article["id"]).execute()
                updated_count += 1

            # Respect S2 rate limits — wait between batches
            if batch_start + BATCH_SIZE < len(articles_with_ids):
                log.info("  Waiting 2s for rate limit...")
                await asyncio.sleep(2)

    log.info("Done. Enriched %d papers, updated %d in DB.", enriched_count, updated_count)

    # Show results
    log.info("--- ArXiv score distribution after enrichment ---")
    for threshold in [0.3, 1.0, 2.0, 5.0, 8.0]:
        r = (
            sb.table("articles")
            .select("id", count="exact")
            .eq("platform", "arxiv")
            .gte("engagement_score", threshold)
            .limit(0)
            .execute()
        )
        log.info("  arxiv score >= %.1f : %d articles", threshold, r.count or 0)

    # Show top papers
    log.info("--- Top 10 ArXiv papers by score ---")
    top = (
        sb.table("articles")
        .select("title, engagement_score, engagement_metrics")
        .eq("platform", "arxiv")
        .order("engagement_score", desc=True)
        .limit(10)
        .execute()
    )
    for p in top.data:
        citations = (p.get("engagement_metrics") or {}).get("citations", 0)
        log.info(
            "  score=%.1f citations=%d  %s",
            p["engagement_score"],
            citations,
            p["title"][:70],
        )


if __name__ == "__main__":
    asyncio.run(main())
