"""Data models for the ingestion pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class RawArticle:
    """Raw article data as fetched from a source, before normalization."""

    title: str
    url: str
    published_at: datetime | None = None
    summary_snippet: str | None = None
    engagement_metrics: dict[str, object] = field(default_factory=dict)
    extra: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class NormalizedArticle:
    """Uniform article metadata ready for dedup, tagging, and scoring."""

    title: str
    url: str
    source_id: str
    published_at: datetime | None
    summary_snippet: str | None
    content_type: str
    platform: str
    engagement_metrics: dict[str, object]
    topic_tags: list[str] = field(default_factory=list)
    engagement_score: float = 0.0
    recommendation_reason: str | None = None


@dataclass(frozen=True)
class Source:
    """Source record from the database."""

    id: str
    name: str
    url: str
    category: str
    type: str
    status: str
    platform: str
    fetch_frequency: str
    reliability_score: float
    notes: str | None = None
