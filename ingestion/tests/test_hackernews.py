"""Tests for the Hacker News fetcher."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ingestion.fetchers.hackernews import HackerNewsFetcher
from ingestion.models import Source

pytestmark = pytest.mark.asyncio


def _make_source() -> Source:
    return Source(
        id="src-1",
        name="Hacker News",
        url="https://news.ycombinator.com",
        category="social",
        type="api",
        status="active",
        platform="hackernews",
        fetch_frequency="every_4h",
        reliability_score=4.5,
        notes=None,
    )


def _mock_response(hits: list[dict]) -> MagicMock:
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {"hits": hits}
    return response


async def test_fetch_queries_search_by_date_endpoint():
    """The Algolia relevance-sorted /search endpoint returns the same top
    historical hits on every call, since relevance ranking barely changes
    run to run. Fetching new content requires the recency-sorted
    /search_by_date endpoint instead.
    """
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _mock_response([])
        await HackerNewsFetcher().fetch(_make_source())

    assert mock_get.await_count > 0
    for call in mock_get.await_args_list:
        requested_url = call.args[0] if call.args else call.kwargs.get("url")
        assert requested_url.endswith("/search_by_date"), (
            f"expected recency-sorted endpoint, got {requested_url}"
        )


async def test_fetch_parses_hits_into_raw_articles():
    hits = [
        {
            "objectID": "123",
            "title": "New open-source LLM released",
            "url": "https://example.com/llm",
            "created_at": "2026-07-30T12:00:00.000Z",
            "points": 150,
            "num_comments": 42,
        }
    ]
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _mock_response(hits)
        articles = await HackerNewsFetcher().fetch(_make_source())

    assert len(articles) == 1
    assert articles[0].title == "New open-source LLM released"
    assert articles[0].url == "https://example.com/llm"
    assert articles[0].engagement_metrics["points"] == 150
