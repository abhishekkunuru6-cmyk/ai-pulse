"""Re-score all existing articles using the current scoring algorithm.

Applies content-type baselines, freshness boost, HF featured boost,
comment boost, and author reputation — the full scoring pipeline.

Usage:
    PYTHONPATH=. ingestion/.venv/bin/python ingestion/rescore.py
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone

from supabase import create_client

from ingestion.config.settings import SUPABASE_KEY, SUPABASE_URL
from ingestion.pipeline.scorer import (
    _freshness_multiplier,
    _normalize_engagement,
    build_author_reputation,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = 500


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except ValueError:
        return None


def main() -> None:
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
    log.info("Loaded %d sources", len(reliability_map))

    # Build author reputation from existing high-scoring papers
    log.info("Building author reputation map...")
    paper_resp = (
        sb.table("articles")
        .select("engagement_score, engagement_metrics")
        .in_("content_type", ["paper"])
        .gte("engagement_score", 5.0)
        .limit(500)
        .execute()
    )
    reputable_authors = build_author_reputation(paper_resp.data, score_threshold=5.0)
    log.info("Found %d reputable authors", len(reputable_authors))

    # Fetch all articles in batches
    offset = 0
    total_updated = 0
    updates_batch: list[dict] = []

    while True:
        log.info("Fetching articles %d–%d ...", offset, offset + BATCH_SIZE - 1)
        resp = (
            sb.table("articles")
            .select("id, source_id, content_type, platform, published_at, engagement_metrics, engagement_score, topic_tags")
            .range(offset, offset + BATCH_SIZE - 1)
            .execute()
        )
        rows = resp.data
        if not rows:
            break

        for row in rows:
            metrics = row.get("engagement_metrics") or {}
            reliability = reliability_map.get(row["source_id"], 3.0)
            content_type = row.get("content_type", "")
            platform = row.get("platform", "")
            published_at = _parse_dt(row.get("published_at"))
            topic_tags = row.get("topic_tags") or []

            engagement = _normalize_engagement(
                metrics,
                content_type=content_type,
                platform=platform,
                reputable_authors=reputable_authors,
                topic_tags=topic_tags,
            )
            freshness = _freshness_multiplier(published_at)
            new_score = round(reliability * engagement * freshness, 2)
            old_score = float(row.get("engagement_score") or 0)

            if abs(new_score - old_score) > 0.001:
                updates_batch.append({"id": row["id"], "score": new_score})

        offset += len(rows)

        # Flush updates in batches
        if len(updates_batch) >= 100:
            _flush_updates(sb, updates_batch)
            total_updated += len(updates_batch)
            updates_batch = []

        if len(rows) < BATCH_SIZE:
            break

    # Final flush
    if updates_batch:
        _flush_updates(sb, updates_batch)
        total_updated += len(updates_batch)

    log.info("Done. Updated %d articles out of %d total.", total_updated, offset)

    # Show score distribution by platform
    log.info("--- Score distribution by platform ---")
    for platform in ["reddit", "github", "hackernews", "arxiv", "blog", "newsletter", "huggingface", "youtube"]:
        for threshold in [0.5, 2.0, 5.0]:
            count_resp = (
                sb.table("articles")
                .select("id", count="exact")
                .eq("platform", platform)
                .gte("engagement_score", threshold)
                .limit(0)
                .execute()
            )
            log.info("  %s score >= %.1f : %d", platform, threshold, count_resp.count or 0)


def _flush_updates(sb, updates: list[dict]) -> None:
    log.info("Updating %d articles...", len(updates))
    for item in updates:
        sb.table("articles").update({"engagement_score": item["score"]}).eq("id", item["id"]).execute()


if __name__ == "__main__":
    main()
