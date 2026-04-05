"""Tests for the deduplicator module."""

from ingestion.models import NormalizedArticle
from ingestion.pipeline.deduplicator import _url_hash, deduplicate


def _make_article(**overrides) -> NormalizedArticle:
    defaults = {
        "title": "Test Article",
        "url": "https://example.com/article",
        "source_id": "src-1",
        "published_at": None,
        "summary_snippet": None,
        "content_type": "news",
        "platform": "blog",
        "engagement_metrics": {},
    }
    return NormalizedArticle(**{**defaults, **overrides})


def test_deduplicate_exact_url():
    articles = [
        _make_article(title="Article 1", url="https://example.com/1"),
        _make_article(title="Article 2", url="https://example.com/1"),
    ]
    result = deduplicate(articles)
    assert len(result) == 1
    assert result[0].title == "Article 1"


def test_deduplicate_url_normalization():
    """URLs differing only in trailing slash or query params are duplicates."""
    articles = [
        _make_article(title="Article 1", url="https://example.com/page/"),
        _make_article(title="Article 2", url="https://example.com/page"),
    ]
    result = deduplicate(articles)
    assert len(result) == 1


def test_deduplicate_fuzzy_title():
    articles = [
        _make_article(title="GPT-5 Released Today!", url="https://a.com/1"),
        _make_article(title="GPT-5 Released Today", url="https://b.com/2"),
    ]
    result = deduplicate(articles)
    assert len(result) == 1


def test_deduplicate_different_titles_kept():
    articles = [
        _make_article(title="GPT-5 Released", url="https://a.com/1"),
        _make_article(title="New Transformer Architecture", url="https://b.com/2"),
    ]
    result = deduplicate(articles)
    assert len(result) == 2


def test_deduplicate_against_existing_urls():
    articles = [
        _make_article(title="New Article", url="https://example.com/new"),
        _make_article(title="Old Article", url="https://example.com/old"),
    ]
    existing = {_url_hash("https://example.com/old")}
    result = deduplicate(articles, existing_urls=existing)
    assert len(result) == 1
    assert result[0].title == "New Article"


def test_deduplicate_empty_list():
    result = deduplicate([])
    assert result == []
