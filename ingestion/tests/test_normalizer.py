"""Tests for the normalizer module."""

from ingestion.models import RawArticle, Source
from ingestion.pipeline.normalizer import normalize


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


def test_normalize_sets_content_type_from_platform():
    source = _make_source(platform="youtube", category="podcast")
    raw = [RawArticle(title="Test Video", url="https://yt.com/v1")]
    result = normalize(raw, source)
    assert result[0].content_type == "video"


def test_normalize_sets_content_type_from_category():
    source = _make_source(platform="hackernews", category="social")
    raw = [RawArticle(title="HN Post", url="https://hn.com/1")]
    result = normalize(raw, source)
    assert result[0].content_type == "social"


def test_normalize_preserves_source_id():
    source = _make_source(id="my-source-id")
    raw = [RawArticle(title="Test", url="https://example.com/1")]
    result = normalize(raw, source)
    assert result[0].source_id == "my-source-id"


def test_normalize_strips_whitespace():
    source = _make_source()
    raw = [RawArticle(title="  Padded Title  ", url="  https://example.com/1  ")]
    result = normalize(raw, source)
    assert result[0].title == "Padded Title"
    assert result[0].url == "https://example.com/1"


def test_normalize_trending_recommendation_reason():
    source = _make_source(name="Hacker News")
    raw = [
        RawArticle(
            title="Hot Post",
            url="https://hn.com/1",
            engagement_metrics={"points": 500, "comments": 100},
        )
    ]
    result = normalize(raw, source)
    assert "Trending" in result[0].recommendation_reason
    assert "500" in result[0].recommendation_reason


def test_normalize_empty_list():
    source = _make_source()
    result = normalize([], source)
    assert result == []
