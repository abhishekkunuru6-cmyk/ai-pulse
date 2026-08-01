"""Tests for the Semantic Scholar fetcher."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ingestion.fetchers import semantic_scholar
from ingestion.fetchers.semantic_scholar import SemanticScholarFetcher
from ingestion.models import Source

pytestmark = pytest.mark.asyncio


def _make_source() -> Source:
    return Source(
        id="src-1",
        name="Semantic Scholar",
        url="https://semanticscholar.org",
        category="research",
        type="api",
        status="active",
        platform="semantic_scholar",
        fetch_frequency="daily",
        reliability_score=4.0,
        notes=None,
    )


def _mock_response(papers: list[dict]) -> MagicMock:
    response = MagicMock()
    response.status_code = 200
    response.raise_for_status = MagicMock()
    response.json.return_value = {"data": papers}
    return response


async def test_fetch_sends_api_key_header_when_configured():
    """The public tier shares a very tight rate limit across all unauthenticated
    callers and returns 429s constantly from cloud/CI IPs. When an API key is
    configured, it must be sent so the fetcher gets its own rate-limit bucket.
    """
    with (
        patch.object(semantic_scholar, "SEMANTIC_SCHOLAR_API_KEY", "test-key-123"),
        patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get,
    ):
        mock_get.return_value = _mock_response([])
        await SemanticScholarFetcher().fetch(_make_source())

    assert mock_get.await_count > 0
    for call in mock_get.await_args_list:
        headers = call.kwargs.get("headers") or {}
        assert headers.get("x-api-key") == "test-key-123"


async def test_fetch_omits_api_key_header_when_not_configured():
    with (
        patch.object(semantic_scholar, "SEMANTIC_SCHOLAR_API_KEY", ""),
        patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get,
    ):
        mock_get.return_value = _mock_response([])
        await SemanticScholarFetcher().fetch(_make_source())

    for call in mock_get.await_args_list:
        headers = call.kwargs.get("headers") or {}
        assert "x-api-key" not in headers
