"""GitHub Releases fetcher — tracks new releases from a curated watchlist of
high-impact open-source AI/ML repos.

GitHub Trending only surfaces repos that are already accumulating stars this
week. This fetcher instead watches specific projects that matter regardless
of whether they're trending, so a major release from an established project
(e.g. llama.cpp, vLLM, transformers) is never missed.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

from ingestion.config.settings import GITHUB_PAT
from ingestion.fetchers.base import BaseFetcher
from ingestion.models import RawArticle, Source

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"

# Curated watchlist of high-impact open-source AI/ML repos.
TRACKED_REPOS: tuple[str, ...] = (
    "ggml-org/llama.cpp",
    "vllm-project/vllm",
    "huggingface/transformers",
    "langchain-ai/langchain",
    "ollama/ollama",
    "ggerganov/whisper.cpp",
    "comfyanonymous/ComfyUI",
    "oobabooga/text-generation-webui",
    "microsoft/autogen",
    "run-llama/llama_index",
    "pytorch/pytorch",
    "stanfordnlp/dspy",
    "BerriAI/litellm",
    "unslothai/unsloth",
    "Lightning-AI/pytorch-lightning",
    "NVIDIA/TensorRT-LLM",
)

_LOOKBACK_DAYS = 14
_RELEASES_PER_REPO = 5


def _truncate(text: str, max_len: int) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _release_to_raw_article(repo: str, release: dict) -> RawArticle | None:
    published_at = _parse_iso_datetime(release.get("published_at"))
    if published_at is None:
        return None

    tag = release.get("tag_name", "")
    name = release.get("name") or tag
    body = release.get("body") or ""
    reactions = release.get("reactions") or {}

    return RawArticle(
        title=f"{repo} {name}".strip(),
        url=release.get("html_url", ""),
        published_at=published_at,
        summary_snippet=_truncate(body, 400) if body else None,
        engagement_metrics={"reactions": reactions.get("total_count", 0)},
        extra={"repo": repo, "tag": tag},
    )


class GitHubReleasesFetcher(BaseFetcher):
    """Fetches recent releases from a curated watchlist of high-impact repos."""

    async def fetch(self, source: Source) -> list[RawArticle]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS)

        headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
        if GITHUB_PAT:
            headers["Authorization"] = f"Bearer {GITHUB_PAT}"
        else:
            logger.warning("GH_TOKEN not set — using unauthenticated GitHub API (60 req/hr)")

        articles: list[RawArticle] = []
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            for repo in TRACKED_REPOS:
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{repo}/releases",
                    params={"per_page": _RELEASES_PER_REPO},
                )
                if response.status_code == 404:
                    logger.warning("Repo not found or has no releases: %s", repo)
                    continue
                response.raise_for_status()

                for release in response.json():
                    if release.get("draft"):
                        continue
                    article = _release_to_raw_article(repo, release)
                    if article is None or article.published_at is None:
                        continue
                    if article.published_at < cutoff:
                        continue
                    articles.append(article)

        return articles
