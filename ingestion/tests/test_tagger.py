"""Tests for the tagger module."""

from ingestion.models import NormalizedArticle
from ingestion.pipeline.tagger import tag_articles


def _make_article(**overrides) -> NormalizedArticle:
    defaults = {
        "title": "Test Article",
        "url": "https://example.com",
        "source_id": "src-1",
        "published_at": None,
        "summary_snippet": None,
        "content_type": "news",
        "platform": "blog",
        "engagement_metrics": {},
    }
    return NormalizedArticle(**{**defaults, **overrides})


def test_tag_llm_keywords():
    articles = [_make_article(title="New GPT-5 language model released")]
    result = tag_articles(articles)
    assert "llms" in result[0].topic_tags


def test_tag_computer_vision():
    articles = [_make_article(title="Stable Diffusion 4.0 image generation")]
    result = tag_articles(articles)
    assert "computer-vision" in result[0].topic_tags


def test_tag_ai_safety():
    articles = [_make_article(title="AI Safety and alignment research update")]
    result = tag_articles(articles)
    assert "ai-safety" in result[0].topic_tags


def test_tag_agents():
    articles = [_make_article(title="Building autonomous agents with function calling")]
    result = tag_articles(articles)
    assert "agents" in result[0].topic_tags


def test_tag_multiple_topics():
    articles = [
        _make_article(
            title="Open source LLM for autonomous agents",
            summary_snippet="A new open-source language model designed for agent workflows",
        )
    ]
    result = tag_articles(articles)
    tags = result[0].topic_tags
    assert "llms" in tags or "open-source-models" in tags
    assert "agents" in tags


def test_tag_no_match_returns_empty():
    articles = [_make_article(title="Weather forecast for tomorrow")]
    result = tag_articles(articles)
    assert result[0].topic_tags == []


def test_tag_arxiv_default():
    articles = [_make_article(title="Something technical", platform="arxiv")]
    result = tag_articles(articles)
    assert "llms" in result[0].topic_tags


def test_tag_preserves_other_fields():
    original = _make_article(title="GPT-5 is here", url="https://test.com/gpt5")
    result = tag_articles([original])
    assert result[0].title == original.title
    assert result[0].url == original.url
