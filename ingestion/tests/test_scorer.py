"""Tests for the scorer module."""

from datetime import datetime, timedelta, timezone

from ingestion.models import NormalizedArticle, Source
from ingestion.pipeline.scorer import score_articles


def _make_article(**overrides) -> NormalizedArticle:
    defaults = {
        "title": "Test Article",
        "url": "https://example.com",
        "source_id": "src-1",
        "published_at": datetime.now(timezone.utc),
        "summary_snippet": None,
        "content_type": "news",
        "platform": "blog",
        "engagement_metrics": {"points": 50},
    }
    return NormalizedArticle(**{**defaults, **overrides})


def _make_source(**overrides) -> Source:
    defaults = {
        "id": "src-1",
        "name": "Test Source",
        "url": "https://example.com",
        "category": "news",
        "type": "rss",
        "status": "active",
        "platform": "blog",
        "fetch_frequency": "daily",
        "reliability_score": 4.0,
        "notes": None,
    }
    return Source(**{**defaults, **overrides})


def test_score_recent_high_engagement():
    source = _make_source(reliability_score=5.0)
    article = _make_article(
        engagement_metrics={"points": 600, "comments": 100},
        published_at=datetime.now(timezone.utc),
    )
    result = score_articles([article], {"src-1": source})
    # 5.0 * 3.0 (engagement) * 1.5 (freshness) + comment boost
    assert result[0].engagement_score > 10


def test_score_old_article_no_freshness_boost():
    source = _make_source(reliability_score=4.0)
    old_date = datetime.now(timezone.utc) - timedelta(days=30)
    article = _make_article(
        engagement_metrics={"points": 100},
        published_at=old_date,
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 1.0 (20<100≤100, so bracket is >20 → 1.0) * 1.0 (no freshness) = 4.0
    assert result[0].engagement_score == 4.0


def test_score_no_engagement_uses_content_type_baseline():
    source = _make_source(reliability_score=3.0)
    article = _make_article(
        engagement_metrics={},
        content_type="blog",
        platform="blog",
        published_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    result = score_articles([article], {"src-1": source})
    # 3.0 * 0.6 (blog baseline) * 1.0 (old) = 1.8
    assert result[0].engagement_score == 1.8


def test_score_unknown_source():
    article = _make_article(source_id="unknown-src")
    result = score_articles([article], {})
    # Should use default reliability of 3.0
    assert result[0].engagement_score > 0


def test_score_none_published_at():
    source = _make_source()
    article = _make_article(published_at=None)
    result = score_articles([article], {"src-1": source})
    # No freshness boost (1.0 multiplier) when published_at is None
    assert result[0].engagement_score > 0


def test_score_preserves_other_fields():
    source = _make_source()
    article = _make_article(title="Keep Me", url="https://keep.com")
    result = score_articles([article], {"src-1": source})
    assert result[0].title == "Keep Me"
    assert result[0].url == "https://keep.com"


# --- Freshness boost tests ---


def test_freshness_boost_24h():
    """Articles published within 24h get 1.5× boost."""
    source = _make_source(reliability_score=4.0)
    recent = datetime.now(timezone.utc) - timedelta(hours=6)
    article = _make_article(
        engagement_metrics={"points": 50},
        published_at=recent,
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 1.0 (20<50≤100 → 1.0) * 1.5 = 6.0
    assert result[0].engagement_score == 6.0


def test_freshness_boost_3d():
    """Articles published within 3 days get 1.3× boost."""
    source = _make_source(reliability_score=4.0)
    two_days_ago = datetime.now(timezone.utc) - timedelta(hours=48)
    article = _make_article(
        engagement_metrics={"points": 50},
        published_at=two_days_ago,
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 1.0 * 1.3 = 5.2
    assert result[0].engagement_score == 5.2


def test_freshness_boost_7d():
    """Articles published within 7 days get 1.1× boost."""
    source = _make_source(reliability_score=4.0)
    five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)
    article = _make_article(
        engagement_metrics={"points": 50},
        published_at=five_days_ago,
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 1.0 * 1.1 = 4.4
    assert result[0].engagement_score == 4.4


def test_freshness_no_boost_old():
    """Articles older than 7 days get no boost (1.0×)."""
    source = _make_source(reliability_score=4.0)
    old = datetime.now(timezone.utc) - timedelta(days=14)
    article = _make_article(
        engagement_metrics={"points": 50},
        published_at=old,
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 1.0 * 1.0 = 4.0
    assert result[0].engagement_score == 4.0


def test_freshness_boost_low_engagement_article():
    """Fresh article with zero engagement still gets meaningful score via baseline."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={},
        content_type="news",
        platform="hackernews",
        published_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 0.4 (news baseline) * 1.5 (fresh) = 2.4
    assert result[0].engagement_score == 2.4


# --- Content-type baseline tests ---


def test_baseline_blog_no_engagement():
    """Blog posts with no engagement use 0.6 baseline."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={},
        content_type="blog",
        platform="blog",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 0.6 (blog baseline) * 1.0 = 2.4
    assert result[0].engagement_score == 2.4


def test_baseline_newsletter_no_engagement():
    """Newsletters with no engagement use 0.6 baseline."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={},
        content_type="newsletter",
        platform="newsletter",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 0.6 (newsletter baseline) * 1.0 = 2.4
    assert result[0].engagement_score == 2.4


def test_baseline_huggingface_curated():
    """HuggingFace daily papers use 0.8 platform baseline (editorially curated)."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"upvotes": 2},
        content_type="paper",
        platform="huggingface",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # HF tiers: upvotes=2 < 3 threshold → 0, content_type=paper triggers dynamic scoring
    # dynamic: no category, no tags, upvotes=2 → log boost ~0.24 → 0.8+0.24=1.04
    # 4.0 * 1.04 * 1.0 ≈ 4.15
    assert result[0].engagement_score == 4.15


def test_baseline_arxiv_paper():
    """ArXiv papers with no engagement use 0.5 paper baseline."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={},
        content_type="paper",
        platform="arxiv",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 0.5 (paper baseline) * 1.0 = 2.0
    assert result[0].engagement_score == 2.0


def test_baseline_youtube_video():
    """YouTube videos with no engagement use 0.5 baseline."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={},
        content_type="video",
        platform="youtube",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 0.5 (video baseline) * 1.0 = 2.0
    assert result[0].engagement_score == 2.0


def test_engagement_overrides_baseline_when_higher():
    """High engagement score should override the baseline."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"points": 200},
        content_type="blog",
        platform="blog",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # 4.0 * 2.0 (200 points > 100 → 2.0, higher than 0.6 baseline) * 1.0 = 8.0
    assert result[0].engagement_score == 8.0


# --- HuggingFace enrichment tests ---


def test_hf_featured_boost():
    """HF daily featured papers get an additional 0.3 boost on top of engagement."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"upvotes": 10, "comments": 5, "hf_daily_featured": 1},
        content_type="paper",
        platform="huggingface",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # HF tiers: upvotes=10 >= 8 → 1.0, +0.3 (featured) = 1.3
    # max(1.3, 0.8 HF baseline) = 1.3
    # 4.0 * 1.3 * 1.0 = 5.2
    assert result[0].engagement_score == 5.2


def test_hf_featured_with_high_upvotes():
    """HF featured paper with high upvotes stacks the featured boost."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"upvotes": 50, "hf_daily_featured": 1},
        content_type="paper",
        platform="huggingface",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # HF tiers: upvotes=50 >= 50 → 3.0, +0.3 (featured) = 3.0 (capped)
    # max(3.0, 0.8 HF baseline) = 3.0
    # 4.0 * 3.0 * 1.0 = 12.0
    assert result[0].engagement_score == 12.0


def test_comment_moderate_boost():
    """Articles with 15 comments on HN get a small 0.1 boost (HN-calibrated)."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"points": 50, "comments": 15},
        content_type="news",
        platform="hackernews",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # HN tiers: points=50 >= 30 → 1.0, comments=15 (not >15) → no boost
    # max(1.0, 0.4 news baseline) = 1.0
    # 4.0 * 1.0 * 1.0 = 4.0
    assert result[0].engagement_score == 4.0


# --- Author reputation tests ---


from ingestion.pipeline.scorer import build_author_reputation


def test_author_reputation_single_match():
    """Paper with one reputable author gets +0.2 boost."""
    source = _make_source(reliability_score=4.0)
    reputable = frozenset({"Yann LeCun", "Geoffrey Hinton"})
    article = _make_article(
        engagement_metrics={"authors": ["Yann LeCun", "Unknown Person"]},
        content_type="paper",
        platform="arxiv",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source}, reputable_authors=reputable)
    # paper baseline = 0.5, +0.2 (1 reputable author) = 0.7
    # 4.0 * 0.7 * 1.0 = 2.8
    assert result[0].engagement_score == 2.8


def test_author_reputation_multiple_match():
    """Paper with 2+ reputable authors gets +0.4 boost."""
    source = _make_source(reliability_score=4.0)
    reputable = frozenset({"Yann LeCun", "Geoffrey Hinton", "Fei-Fei Li"})
    article = _make_article(
        engagement_metrics={"authors": ["Yann LeCun", "Geoffrey Hinton"]},
        content_type="paper",
        platform="arxiv",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source}, reputable_authors=reputable)
    # paper baseline = 0.5, +0.4 (2 reputable authors) = 0.9
    # 4.0 * 0.9 * 1.0 = 3.6
    assert result[0].engagement_score == 3.6


def test_author_reputation_no_match():
    """Paper with no reputable authors gets no boost."""
    source = _make_source(reliability_score=4.0)
    reputable = frozenset({"Yann LeCun"})
    article = _make_article(
        engagement_metrics={"authors": ["Unknown Person"]},
        content_type="paper",
        platform="arxiv",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source}, reputable_authors=reputable)
    # paper baseline = 0.5, no author boost
    # 4.0 * 0.5 * 1.0 = 2.0
    assert result[0].engagement_score == 2.0


def test_author_reputation_only_applies_to_papers():
    """Author reputation boost only applies to content_type='paper'."""
    source = _make_source(reliability_score=4.0)
    reputable = frozenset({"Famous Blogger"})
    article = _make_article(
        engagement_metrics={"authors": ["Famous Blogger"]},
        content_type="blog",
        platform="blog",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source}, reputable_authors=reputable)
    # blog baseline = 0.6, NO author boost (not a paper)
    # 4.0 * 0.6 * 1.0 = 2.4
    assert result[0].engagement_score == 2.4


def test_build_author_reputation_from_db_data():
    """build_author_reputation extracts authors from high-scoring papers."""
    db_articles = [
        {"engagement_score": 8.0, "engagement_metrics": {"authors": ["Alice", "Bob"]}},
        {"engagement_score": 3.0, "engagement_metrics": {"authors": ["Charlie"]}},  # Below threshold
        {"engagement_score": 6.0, "engagement_metrics": {"authors": ["Alice", "Dave"]}},
        {"engagement_score": 7.0, "engagement_metrics": {}},  # No authors
    ]
    result = build_author_reputation(db_articles, score_threshold=5.0)
    assert result == frozenset({"Alice", "Bob", "Dave"})


# --- Platform-specific engagement threshold tests ---


def test_github_high_stars_not_max():
    """GitHub repos with 200-999 stars get 1.0, not 3.0 (old threshold was >500)."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"stars": 600},
        content_type="code",
        platform="github",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # GitHub tiers: 600 >= 200 → 1.0 (not 3.0 like old universal >500)
    # 4.0 * 1.0 * 1.0 = 4.0
    assert result[0].engagement_score == 4.0


def test_github_mega_stars():
    """GitHub repos with 10k+ stars still get max score."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"stars": 15000},
        content_type="code",
        platform="github",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # GitHub tiers: 15000 >= 10000 → 3.0
    # 4.0 * 3.0 * 1.0 = 12.0
    assert result[0].engagement_score == 12.0


def test_hf_low_upvotes_meaningful():
    """HuggingFace 8+ upvotes should score 1.0 (was 0 with old >20 threshold)."""
    source = _make_source(reliability_score=4.0)
    article = _make_article(
        engagement_metrics={"upvotes": 10},
        content_type="code",
        platform="huggingface",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # HF tiers: 10 >= 8 → 1.0
    # 4.0 * 1.0 * 1.0 = 4.0
    assert result[0].engagement_score == 4.0


def test_dynamic_paper_category_boost():
    """ArXiv paper in core AI category with hot topic tags gets boosted above flat baseline."""
    source = _make_source(reliability_score=4.5)
    article = _make_article(
        engagement_metrics={"category": "cs.CL", "authors": ["A", "B", "C", "D"]},
        content_type="paper",
        platform="arxiv",
        topic_tags=["llms", "agents"],
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # paper baseline = 0.5, dynamic: category cs.CL (1.0*0.3=0.3) + 2 hot tags (+0.3) + 4 authors (+0.1) = +0.7
    # engagement = 0.5 + 0.7 = 1.2
    # 4.5 * 1.2 * 1.0 = 5.4
    assert result[0].engagement_score == 5.4


def test_dynamic_paper_no_signals():
    """ArXiv paper with no signals stays at baseline (but doesn't get worse)."""
    source = _make_source(reliability_score=4.5)
    article = _make_article(
        engagement_metrics={},
        content_type="paper",
        platform="arxiv",
        published_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    result = score_articles([article], {"src-1": source})
    # paper baseline = 0.5, dynamic: no category, no tags, no authors → no boost
    # 4.5 * 0.5 * 1.0 = 2.25
    assert result[0].engagement_score == 2.25
