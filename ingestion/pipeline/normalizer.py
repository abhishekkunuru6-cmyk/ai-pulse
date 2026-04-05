"""Convert raw articles from various sources into a uniform format."""

from __future__ import annotations

from ingestion.models import NormalizedArticle, RawArticle, Source

# Map source category to default content type
CATEGORY_TO_CONTENT_TYPE: dict[str, str] = {
    "research": "paper",
    "social": "social",
    "code": "code",
    "news": "news",
    "company": "news",
    "conference": "paper",
    "people": "blog",
    "benchmark": "benchmark",
    "podcast": "video",
}

# Override content type for specific platforms
PLATFORM_CONTENT_TYPE: dict[str, str] = {
    "youtube": "video",
    "newsletter": "newsletter",
    "blog": "blog",
}


def _safe_int(value: object, default: int = 0) -> int:
    """Safely convert a value to int."""
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def normalize(
    raw_articles: list[RawArticle], source: Source
) -> list[NormalizedArticle]:
    """Convert a list of raw articles into normalized articles."""
    return [_normalize_one(article, source) for article in raw_articles]


def _normalize_one(raw: RawArticle, source: Source) -> NormalizedArticle:
    content_type = PLATFORM_CONTENT_TYPE.get(
        source.platform,
        CATEGORY_TO_CONTENT_TYPE.get(source.category, "news"),
    )

    # Build recommendation reason from source
    reason = f"From {source.name}"
    engagement = raw.engagement_metrics
    points = _safe_int(engagement.get("points"))
    upvotes = _safe_int(engagement.get("upvotes"))
    if points > 100:
        reason = f"Trending on {source.name} ({points} points)"
    elif upvotes > 100:
        reason = f"Popular on {source.name} ({upvotes} upvotes)"

    # Carry forward author names from extra into engagement_metrics
    # so they survive normalization and are stored in the DB
    metrics = dict(raw.engagement_metrics)
    authors = raw.extra.get("authors")
    if isinstance(authors, list) and authors:
        metrics["authors"] = authors[:5]

    return NormalizedArticle(
        title=raw.title.strip(),
        url=raw.url.strip(),
        source_id=source.id,
        published_at=raw.published_at,
        summary_snippet=raw.summary_snippet,
        content_type=content_type,
        platform=source.platform,
        engagement_metrics=metrics,
        recommendation_reason=reason,
    )
