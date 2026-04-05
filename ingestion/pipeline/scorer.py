"""Compute initial engagement score for articles.

The stored engagement_score is:
  source_reliability * normalized_engagement * freshness_boost

Freshness boost rewards recently published articles that haven't yet
accumulated engagement metrics (upvotes, citations, etc.).

Platform-specific engagement thresholds ensure fair comparison across
platforms with vastly different engagement volumes (e.g. 10 HF upvotes
is significant, while 10 Reddit upvotes is noise).
"""

from __future__ import annotations

import math
from dataclasses import replace
from datetime import datetime, timezone

from ingestion.models import NormalizedArticle, Source

# Freshness boost tiers: (max_age_hours, multiplier)
_FRESHNESS_TIERS: tuple[tuple[int, float], ...] = (
    (24, 1.5),    # Published within last 24h
    (72, 1.3),    # Published within last 3 days
    (168, 1.1),   # Published within last 7 days
)

# Minimum engagement baselines by content type.
# These replace the 0.1 floor for sources that don't provide engagement data.
_CONTENT_TYPE_BASELINES: dict[str, float] = {
    "paper": 0.5,       # ArXiv/conference papers — peer-worthy by existing
    "blog": 0.6,        # Blog posts from curated sources
    "newsletter": 0.6,  # Newsletters — editorially curated
    "video": 0.5,       # YouTube — selected channels
    "news": 0.4,        # News articles
    "benchmark": 0.5,   # Benchmark results
    "code": 0.4,        # GitHub repos (usually have stars)
    "social": 0.3,      # Reddit/HN (usually have upvotes)
}

# Platform-specific overrides (take precedence over content type)
_PLATFORM_BASELINES: dict[str, float] = {
    "huggingface": 0.8,  # HF daily papers — already editorially selected
}

# Platform-specific engagement thresholds: (threshold, score) pairs.
# Each platform uses thresholds calibrated to its typical engagement volume.
# Scored using the FIRST matching tier (highest threshold first).
_PLATFORM_ENGAGEMENT_TIERS: dict[str, tuple[tuple[int, float], ...]] = {
    "huggingface": (
        (50, 3.0),   # 50+ upvotes on HF is exceptional
        (20, 2.0),   # 20+ is very popular
        (8, 1.0),    # 8+ is notable
        (3, 0.5),    # 3+ is above average
    ),
    "github": (
        (10000, 3.0),  # 10k+ stars — mega popular
        (1000, 2.0),   # 1k+ — well-known
        (200, 1.0),    # 200+ — getting traction
        (50, 0.5),     # 50+ — modest interest
    ),
    "reddit": (
        (500, 3.0),   # 500+ upvotes — front page tier
        (100, 2.0),   # 100+ — popular thread
        (30, 1.0),    # 30+ — decent discussion
        (10, 0.5),    # 10+ — some interest
    ),
    "hackernews": (
        (300, 3.0),   # 300+ points — top of front page
        (100, 2.0),   # 100+ — front page
        (30, 1.0),    # 30+ — decent traction
        (10, 0.5),    # 10+ — some interest
    ),
}

# ArXiv categories ranked by relevance to AI/ML (higher = more relevant).
_ARXIV_CATEGORY_RELEVANCE: dict[str, float] = {
    "cs.AI": 1.0,    # Artificial Intelligence — core
    "cs.CL": 1.0,    # Computation and Language (NLP) — core
    "cs.LG": 1.0,    # Machine Learning — core
    "cs.CV": 0.8,    # Computer Vision
    "cs.NE": 0.7,    # Neural and Evolutionary Computing
    "cs.IR": 0.6,    # Information Retrieval
    "cs.RO": 0.5,    # Robotics
    "cs.MA": 0.5,    # Multi-Agent Systems
    "stat.ML": 0.8,  # Statistics: Machine Learning
    "cs.CR": 0.3,    # Cryptography — low unless AI-related
    "cs.SE": 0.3,    # Software Engineering
}

# Hot topic tags that signal high-interest papers
_HOT_TOPIC_TAGS: frozenset[str] = frozenset({
    "llms", "agents", "reinforcement-learning", "multimodal",
    "open-source-models", "ai-safety", "alignment",
})


def score_articles(
    articles: list[NormalizedArticle],
    sources_map: dict[str, Source],
    reputable_authors: frozenset[str] | None = None,
) -> list[NormalizedArticle]:
    """Score each article: reliability * engagement * freshness.

    If reputable_authors is provided, papers with known prolific authors
    get a small boost.
    """
    authors = reputable_authors or frozenset()
    return [
        _score_one(article, sources_map.get(article.source_id), authors)
        for article in articles
    ]


def _score_one(
    article: NormalizedArticle,
    source: Source | None,
    reputable_authors: frozenset[str],
) -> NormalizedArticle:
    reliability = source.reliability_score if source else 3.0
    engagement = _normalize_engagement(
        article.engagement_metrics,
        content_type=article.content_type,
        platform=article.platform,
        reputable_authors=reputable_authors,
        topic_tags=list(article.topic_tags),
    )
    freshness = _freshness_multiplier(article.published_at)

    score = round(reliability * engagement * freshness, 2)
    return replace(article, engagement_score=score)


def _freshness_multiplier(published_at: datetime | None) -> float:
    """Return a multiplier that boosts recently published articles.

    Articles with no publish date get no boost (1.0).
    """
    if published_at is None:
        return 1.0

    now = datetime.now(timezone.utc)
    # Handle naive datetimes by assuming UTC
    pub = published_at if published_at.tzinfo else published_at.replace(tzinfo=timezone.utc)
    age_hours = (now - pub).total_seconds() / 3600

    if age_hours < 0:
        # Future date (clock skew) — treat as very fresh
        return _FRESHNESS_TIERS[0][1]

    for max_age, multiplier in _FRESHNESS_TIERS:
        if age_hours <= max_age:
            return multiplier

    return 1.0


def _normalize_engagement(
    metrics: dict[str, object],
    content_type: str = "",
    platform: str = "",
    reputable_authors: frozenset[str] | None = None,
    topic_tags: list[str] | None = None,
) -> float:
    """Normalize various engagement metrics to a 0.1-3.0 scale.

    Uses platform-specific thresholds so that engagement is compared
    within each platform's own scale (e.g. 10 HF upvotes != 10 Reddit upvotes).
    Falls back to content-type baselines when engagement data is missing.
    """
    baseline = _PLATFORM_BASELINES.get(
        platform,
        _CONTENT_TYPE_BASELINES.get(content_type, 0.1),
    )

    points = _safe_int(metrics.get("points"))
    upvotes = _safe_int(metrics.get("upvotes"))
    stars = _safe_int(metrics.get("stars"))
    comments = _safe_int(metrics.get("comments"))
    citations = _safe_int(metrics.get("citations"))
    influential = _safe_int(metrics.get("influential_citations"))

    # --- Platform-specific primary engagement scoring ---
    score = 0.0
    platform_tiers = _PLATFORM_ENGAGEMENT_TIERS.get(platform)

    if platform_tiers is not None:
        # Use platform-calibrated thresholds
        primary = max(points, upvotes, stars)
        for threshold, tier_score in platform_tiers:
            if primary >= threshold:
                score = tier_score
                break
    else:
        # Default thresholds for platforms without custom tiers
        primary = max(points, upvotes, stars)
        if primary > 500:
            score = 3.0
        elif primary > 100:
            score = 2.0
        elif primary > 20:
            score = 1.0
        elif primary > 5:
            score = 0.5

    # --- Citation-based scoring for academic papers ---
    if citations > 0 and score < 0.5:
        if citations > 50:
            score = 3.0
        elif citations > 20:
            score = 2.0
        elif citations > 5:
            score = 1.0
        elif citations > 0:
            score = 0.5

    if influential > 3:
        score = min(score + 0.5, 3.0)

    # --- Comment boost (platform-calibrated) ---
    if platform == "hackernews":
        if comments > 200:
            score = min(score + 0.5, 3.0)
        elif comments > 50:
            score = min(score + 0.3, 3.0)
        elif comments > 15:
            score = min(score + 0.1, 3.0)
    elif platform == "reddit":
        if comments > 100:
            score = min(score + 0.5, 3.0)
        elif comments > 30:
            score = min(score + 0.2, 3.0)
    else:
        if comments > 50:
            score = min(score + 0.5, 3.0)
        elif comments > 10:
            score = min(score + 0.2, 3.0)

    # --- HuggingFace daily featured boost ---
    hf_featured = _safe_int(metrics.get("hf_daily_featured"))
    if hf_featured > 0:
        score = min(score + 0.3, 3.0)

    # --- Dynamic paper scoring (when no citations/engagement) ---
    if content_type == "paper" and score < baseline + 0.1:
        score = max(score, baseline)
        score = _dynamic_paper_score(score, metrics, topic_tags or [])

    # Apply baseline floor
    score = max(score, baseline)

    # --- Author reputation boost (papers only, after baseline) ---
    if reputable_authors and content_type == "paper":
        authors = metrics.get("authors")
        if isinstance(authors, list):
            matching = sum(1 for a in authors if a in reputable_authors)
            if matching >= 2:
                score = min(score + 0.4, 3.0)
            elif matching == 1:
                score = min(score + 0.2, 3.0)

    return score


def _dynamic_paper_score(
    base_score: float,
    metrics: dict[str, object],
    topic_tags: list[str],
) -> float:
    """Differentiate papers that lack citation data using available signals.

    Signals used:
    - ArXiv category relevance (cs.CL/cs.LG more relevant than cs.CR)
    - Topic tags matching hot AI topics (agents, LLMs, etc.)
    - Author count as proxy for collaboration breadth
    - HuggingFace upvotes (for cross-listed papers)
    """
    boost = 0.0

    # Signal 1: ArXiv category relevance
    category = str(metrics.get("category", ""))
    if category:
        relevance = _ARXIV_CATEGORY_RELEVANCE.get(category, 0.2)
        boost += relevance * 0.3  # Up to +0.3 for core AI categories

    # Signal 2: Topic tag relevance — hot topics get a boost
    hot_matches = sum(1 for t in topic_tags if t in _HOT_TOPIC_TAGS)
    if hot_matches >= 2:
        boost += 0.3
    elif hot_matches == 1:
        boost += 0.15

    # Signal 3: Author count — larger teams often indicate significant work
    authors = metrics.get("authors")
    if isinstance(authors, list):
        author_count = len(authors)
        if author_count >= 8:
            boost += 0.2   # Large collaboration
        elif author_count >= 4:
            boost += 0.1   # Medium team
    # Single-author papers from named researchers handled by author reputation

    # Signal 4: Log-scale upvotes for HF-listed papers
    upvotes = _safe_int(metrics.get("upvotes"))
    if upvotes > 0:
        boost += min(0.3, 0.15 * math.log2(upvotes + 1))

    return min(base_score + boost, 3.0)


def build_author_reputation(articles_data: list[dict], score_threshold: float = 5.0) -> frozenset[str]:
    """Build a set of reputable authors from high-scoring paper articles.

    Args:
        articles_data: List of article dicts from DB with engagement_metrics and
                       engagement_score fields.
        score_threshold: Minimum engagement_score to consider an article "high quality".

    Returns:
        Frozen set of author names that appear in high-scoring papers.
    """
    reputable: set[str] = set()
    for article in articles_data:
        score = float(article.get("engagement_score", 0) or 0)
        if score < score_threshold:
            continue
        metrics = article.get("engagement_metrics") or {}
        authors = metrics.get("authors")
        if isinstance(authors, list):
            for name in authors:
                if isinstance(name, str) and name.strip():
                    reputable.add(name.strip())
    return frozenset(reputable)


def _safe_int(value: object) -> int:
    """Safely convert a value to int."""
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return 0
    return 0
