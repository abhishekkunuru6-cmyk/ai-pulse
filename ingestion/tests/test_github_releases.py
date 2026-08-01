"""Tests for the GitHub Releases fetcher (curated repo watchlist)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ingestion.fetchers.github_releases import TRACKED_REPOS, GitHubReleasesFetcher
from ingestion.models import Source

pytestmark = pytest.mark.asyncio


def _make_source() -> Source:
    return Source(
        id="src-1",
        name="GitHub Releases (tracked)",
        url="https://github.com",
        category="code",
        type="api",
        status="active",
        platform="github_releases",
        fetch_frequency="every_6h",
        reliability_score=4.0,
        notes=None,
    )


def _mock_response(payload: object, status_code: int = 200) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.raise_for_status = MagicMock()
    response.json.return_value = payload
    return response


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def test_fetch_queries_releases_endpoint_for_every_tracked_repo():
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _mock_response([])
        await GitHubReleasesFetcher().fetch(_make_source())

    requested_urls = {call.args[0] for call in mock_get.await_args_list}
    for repo in TRACKED_REPOS:
        assert f"https://api.github.com/repos/{repo}/releases" in requested_urls


async def test_fetch_returns_recent_release_as_article():
    recent = datetime.now(timezone.utc) - timedelta(days=2)
    release = {
        "tag_name": "v0.5.0",
        "name": "v0.5.0",
        "html_url": "https://github.com/ollama/ollama/releases/tag/v0.5.0",
        "published_at": _iso(recent),
        "body": "Adds new model support.",
        "draft": False,
        "reactions": {"total_count": 12},
    }

    async def fake_get(url, **kwargs):
        if url.endswith("ollama/ollama/releases"):
            return _mock_response([release])
        return _mock_response([])

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=fake_get):
        articles = await GitHubReleasesFetcher().fetch(_make_source())

    matches = [a for a in articles if a.url == release["html_url"]]
    assert len(matches) == 1
    assert "v0.5.0" in matches[0].title


async def test_fetch_excludes_stale_and_draft_releases():
    old = datetime.now(timezone.utc) - timedelta(days=365)
    stale_release = {
        "tag_name": "v0.0.1",
        "name": "v0.0.1",
        "html_url": "https://github.com/ollama/ollama/releases/tag/v0.0.1",
        "published_at": _iso(old),
        "body": "",
        "draft": False,
    }
    draft_release = {
        "tag_name": "v0.6.0",
        "name": "v0.6.0",
        "html_url": "https://github.com/ollama/ollama/releases/tag/v0.6.0",
        "published_at": _iso(datetime.now(timezone.utc)),
        "body": "",
        "draft": True,
    }

    async def fake_get(url, **kwargs):
        if url.endswith("ollama/ollama/releases"):
            return _mock_response([stale_release, draft_release])
        return _mock_response([])

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=fake_get):
        articles = await GitHubReleasesFetcher().fetch(_make_source())

    assert articles == []


async def test_fetch_skips_repo_with_no_releases_without_raising():
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _mock_response({"message": "Not Found"}, status_code=404)
        articles = await GitHubReleasesFetcher().fetch(_make_source())

    assert articles == []
