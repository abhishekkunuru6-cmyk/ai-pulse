"""One-time backfill script to fetch the last 30 days of historical data.

Sources that support historical queries:
  - ArXiv: API supports search by date range via submittedDate
  - Hacker News: Algolia API supports numericFilters on created_at_i (unix timestamp)
  - Reddit: /top?t=month returns top posts of the last month
  - GitHub: Search API supports pushed:>YYYY-MM-DD

Sources that DON'T support backfill (feed-based, returns only recent):
  - RSS feeds (blogs, newsletters) — only current feed items
  - HuggingFace daily papers — only today's papers
  - Papers With Code — only trending now
  - OpenReview — requires auth

Usage:
    PYTHONPATH=. ingestion/.venv/bin/python ingestion/backfill.py
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import httpx
from supabase import create_client

from ingestion.config.settings import (
    BATCH_UPSERT_SIZE,
    SUPABASE_KEY,
    SUPABASE_URL,
    REDDIT_USER_AGENT,
)
from ingestion.models import NormalizedArticle, RawArticle, Source
from ingestion.pipeline.deduplicator import deduplicate
from ingestion.pipeline.normalizer import normalize
from ingestion.pipeline.scorer import score_articles
from ingestion.pipeline.tagger import tag_articles

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("backfill")


# ──────────────────────────────────────────────
# AI relevance filter — reject non-AI content
# ──────────────────────────────────────────────

AI_KEYWORDS = re.compile(
    r"\b("
    r"ai|artificial intelligence|machine learning|deep learning|neural net"
    r"|llm|large language model|gpt|chatgpt|claude|gemini|copilot"
    r"|openai|anthropic|deepmind|mistral|llama|qwen|phi-\d"
    r"|transformer|diffusion|stable diffusion|midjourney|dall-e|sora"
    r"|reinforcement learning|rlhf|fine-tun|rag|retrieval augmented"
    r"|computer vision|object detection|segmentation|image generat"
    r"|nlp|natural language|text-to-|speech-to-|text generat"
    r"|embedding|vector databas|token|inference|training|gpu|tpu"
    r"|hugging face|huggingface|pytorch|tensorflow|jax"
    r"|agent|agentic|mcp|tool use|function call|chain of thought"
    r"|benchmark|leaderboard|eval|alignment|safety"
    r"|lora|quantiz|pruning|distill|mlops|model serv"
    r"|multimodal|vision-language|reasoning|coding model"
    r"|open source model|open-source model|open weight"
    r")\b",
    re.IGNORECASE,
)


def is_ai_relevant(title: str, summary: str | None = None) -> bool:
    """Check if an article title/summary contains AI-related keywords."""
    text = f"{title} {summary or ''}"
    return bool(AI_KEYWORDS.search(text))


# ──────────────────────────────────────────────
# ArXiv backfill — query by date range per week
# ──────────────────────────────────────────────

ARXIV_API_URL = "https://export.arxiv.org/api/query"
ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.CV"]
import xml.etree.ElementTree as ET

ATOM_NS = "{http://www.w3.org/2005/Atom}"


async def backfill_arxiv(weeks: int = 4) -> list[RawArticle]:
    """Fetch ArXiv papers from the last N weeks, week by week."""
    articles: list[RawArticle] = []
    now = datetime.now(timezone.utc)

    for week in range(weeks):
        end = now - timedelta(weeks=week)
        start = end - timedelta(weeks=1)
        start_str = start.strftime("%Y%m%d")
        end_str = end.strftime("%Y%m%d")

        for cat in ARXIV_CATEGORIES:
            query = f"cat:{cat} AND submittedDate:[{start_str} TO {end_str}]"
            logger.info("ArXiv: fetching %s week-%d (%s to %s)", cat, week + 1, start_str, end_str)

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    ARXIV_API_URL,
                    params={
                        "search_query": query,
                        "sortBy": "submittedDate",
                        "sortOrder": "descending",
                        "max_results": 50,
                    },
                )
                resp.raise_for_status()

            root = ET.fromstring(resp.text)
            for entry in root.findall(f"{ATOM_NS}entry"):
                title = (entry.findtext(f"{ATOM_NS}title") or "").strip().replace("\n", " ")
                url = entry.findtext(f"{ATOM_NS}id") or ""
                published = entry.findtext(f"{ATOM_NS}published")
                summary = (entry.findtext(f"{ATOM_NS}summary") or "").strip().replace("\n", " ")

                pub_dt = None
                if published:
                    try:
                        pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                if title and url:
                    articles.append(RawArticle(
                        title=title,
                        url=url,
                        published_at=pub_dt,
                        summary_snippet=summary[:300] if summary else None,
                        engagement_metrics={"category": cat},
                        extra={"backfill": True},
                    ))

            # Rate limit: ArXiv asks for 3s between requests
            await asyncio.sleep(3)

    logger.info("ArXiv backfill: %d articles", len(articles))
    return articles


# ──────────────────────────────────────────────
# Hacker News backfill — day-by-day via Algolia
# ──────────────────────────────────────────────

HN_ALGOLIA_URL = "https://hn.algolia.com/api/v1/search"
HN_KEYWORDS = [
    "AI", "LLM", "GPT", "machine learning", "deep learning",
    "OpenAI", "Anthropic", "Claude", "Llama", "Mistral",
    "neural network", "transformer", "diffusion",
]


async def backfill_hackernews(days: int = 30) -> list[RawArticle]:
    """Fetch AI-related HN posts day by day for better date coverage."""
    articles: list[RawArticle] = []
    now = datetime.now(timezone.utc)
    seen_urls: set[str] = set()

    for day_offset in range(days):
        end = now - timedelta(days=day_offset)
        start = end - timedelta(days=1)
        start_ts = int(start.timestamp())
        end_ts = int(end.timestamp())

        for keyword in HN_KEYWORDS[:8]:
            logger.info("HN: fetching '%s' day-%d", keyword, day_offset + 1)

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    HN_ALGOLIA_URL,
                    params={
                        "query": keyword,
                        "tags": "story",
                        "numericFilters": f"points>30,created_at_i>{start_ts},created_at_i<{end_ts}",
                        "hitsPerPage": 20,
                    },
                )
                resp.raise_for_status()

            for hit in resp.json().get("hits", []):
                title = hit.get("title", "")

                # AI relevance filter
                if not is_ai_relevant(title):
                    continue

                url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}"
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                created_at = hit.get("created_at")
                pub_dt = None
                if created_at:
                    try:
                        pub_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                articles.append(RawArticle(
                    title=title,
                    url=url,
                    published_at=pub_dt,
                    summary_snippet=None,
                    engagement_metrics={
                        "points": hit.get("points", 0),
                        "comments": hit.get("num_comments", 0),
                    },
                    extra={"hn_id": hit.get("objectID"), "backfill": True},
                ))

            await asyncio.sleep(0.5)  # Be polite to Algolia

    logger.info("HN backfill: %d articles (AI-filtered)", len(articles))
    return articles


# ──────────────────────────────────────────────
# Reddit backfill — /top?t=month for each subreddit
# ──────────────────────────────────────────────

REDDIT_PUBLIC_BASE = "https://www.reddit.com"
REDDIT_SUBREDDITS = [
    "MachineLearning", "LocalLLaMA", "artificial", "singularity",
    "deeplearning", "ChatGPT", "OpenAI", "StableDiffusion",
    "ArtificialIntelligence", "PromptEngineering", "LangChain", "ClaudeAI",
]


async def backfill_reddit() -> list[RawArticle]:
    """Fetch top posts of the last month from all tracked subreddits."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    for sub in REDDIT_SUBREDDITS:
        logger.info("Reddit: fetching r/%s /top?t=month", sub)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{REDDIT_PUBLIC_BASE}/r/{sub}/top.json",
                    headers={"User-Agent": REDDIT_USER_AGENT},
                    params={"t": "month", "limit": 50, "raw_json": 1},
                )
                resp.raise_for_status()

            for child in resp.json().get("data", {}).get("children", []):
                post = child.get("data", {})
                if post.get("stickied"):
                    continue

                title = post.get("title", "")

                # AI relevance filter (skip for AI-specific subreddits)
                ai_subreddits = {"MachineLearning", "LocalLLaMA", "deeplearning",
                                 "ChatGPT", "OpenAI", "StableDiffusion",
                                 "LangChain", "ClaudeAI"}
                if sub not in ai_subreddits and not is_ai_relevant(title):
                    continue

                url = post.get("url", "")
                if post.get("is_self"):
                    url = f"https://reddit.com{post.get('permalink', '')}"

                if url in seen_urls:
                    continue
                seen_urls.add(url)

                created_utc = post.get("created_utc")
                pub_dt = (
                    datetime.fromtimestamp(created_utc, tz=timezone.utc)
                    if created_utc else None
                )

                selftext = post.get("selftext", "")
                snippet = selftext[:300] + "..." if len(selftext) > 300 else selftext if selftext else None

                articles.append(RawArticle(
                    title=title,
                    url=url,
                    published_at=pub_dt,
                    summary_snippet=snippet,
                    engagement_metrics={
                        "upvotes": post.get("ups", 0),
                        "comments": post.get("num_comments", 0),
                        "upvote_ratio": post.get("upvote_ratio", 0),
                        "subreddit": sub,
                    },
                    extra={"reddit_id": post.get("id"), "backfill": True},
                ))
        except httpx.HTTPError as e:
            logger.warning("Reddit r/%s failed: %s", sub, e)

        await asyncio.sleep(2)  # Reddit rate limiting

    logger.info("Reddit backfill: %d articles (AI-filtered)", len(articles))
    return articles


# ──────────────────────────────────────────────
# GitHub backfill — search repos pushed in last 30 days
# ──────────────────────────────────────────────

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"
GITHUB_QUERIES = ["machine learning", "LLM", "AI agent", "deep learning", "diffusion model"]


async def backfill_github() -> list[RawArticle]:
    """Fetch trending AI/ML repos from the last 30 days."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()
    since = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    for query in GITHUB_QUERIES:
        logger.info("GitHub: fetching '%s' pushed since %s", query, since)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    GITHUB_SEARCH_URL,
                    params={
                        "q": f"{query} pushed:>{since}",
                        "sort": "stars",
                        "order": "desc",
                        "per_page": 30,
                    },
                    headers={"Accept": "application/vnd.github.v3+json"},
                )
                resp.raise_for_status()

            for repo in resp.json().get("items", []):
                url = repo.get("html_url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                # Use pushed_at as publish date (when repo was last active)
                pushed = repo.get("pushed_at")
                pub_dt = None
                if pushed:
                    try:
                        pub_dt = datetime.fromisoformat(pushed.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                articles.append(RawArticle(
                    title=f"{repo.get('full_name', '')} — {repo.get('description', 'No description')}"[:200],
                    url=url,
                    published_at=pub_dt,
                    summary_snippet=repo.get("description"),
                    engagement_metrics={
                        "stars": repo.get("stargazers_count", 0),
                        "forks": repo.get("forks_count", 0),
                        "language": repo.get("language"),
                    },
                    extra={"topics": repo.get("topics", []), "backfill": True},
                ))
        except httpx.HTTPError as e:
            logger.warning("GitHub '%s' failed: %s", query, e)

        await asyncio.sleep(7)  # GitHub: 10 req/min unauthenticated

    logger.info("GitHub backfill: %d articles", len(articles))
    return articles


# ──────────────────────────────────────────────
# Main backfill orchestrator
# ──────────────────────────────────────────────

async def run_backfill(period: str = "1month") -> None:
    """Run the full backfill pipeline for the given period."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Load sources for normalization
    result = supabase.table("sources").select("*").eq("status", "active").execute()
    all_sources: list[Source] = []
    platform_source_map: dict[str, Source] = {}

    for row in result.data:
        src = Source(
            id=row["id"],
            name=row["name"],
            url=row["url"],
            category=row["category"],
            type=row["type"],
            status=row["status"],
            platform=row["platform"],
            fetch_frequency=row["fetch_frequency"],
            reliability_score=float(row.get("reliability_score", 3.0)),
            notes=row.get("notes"),
        )
        all_sources.append(src)
        if src.platform not in platform_source_map:
            platform_source_map[src.platform] = src

    sources_map = {s.id: s for s in all_sources}

    # Step 1: Delete old junk articles (non-AI content, very old dates)
    logger.info("Cleaning up non-AI articles from previous backfill...")
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=35)).isoformat()

    # Delete articles with published_at before 2026 (old GitHub repos)
    del_result = supabase.table("articles").delete().lt("published_at", "2026-02-01T00:00:00Z").execute()
    deleted_old = len(del_result.data) if del_result.data else 0
    logger.info("Deleted %d articles with dates before 2026-02-01", deleted_old)

    # Load existing URLs for dedup
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    url_result = (
        supabase.table("articles")
        .select("url")
        .gte("created_at", cutoff)
        .execute()
    )
    existing_urls = {row["url"] for row in url_result.data}
    logger.info("Existing articles: %d", len(existing_urls))

    # Run all backfills
    cfg = PERIOD_CONFIG.get(period, PERIOD_CONFIG["1month"])
    weeks = cfg["weeks"]
    days = cfg["days"]

    logger.info("=" * 60)
    logger.info("Starting %s backfill (%d days, with AI relevance filter)", period, days)
    logger.info("=" * 60)

    start_time = time.time()

    arxiv_raw = await backfill_arxiv(weeks=weeks)
    hn_raw = await backfill_hackernews(days=days)
    reddit_raw = await backfill_reddit()
    github_raw = await backfill_github()

    # Normalize each batch with the appropriate source
    all_normalized: list[NormalizedArticle] = []

    for platform, raw_articles in [
        ("arxiv", arxiv_raw),
        ("hackernews", hn_raw),
        ("reddit", reddit_raw),
        ("github", github_raw),
    ]:
        source = platform_source_map.get(platform)
        if not source:
            logger.warning("No source found for platform %s, skipping %d articles", platform, len(raw_articles))
            continue
        normalized = normalize(raw_articles, source)
        all_normalized.extend(normalized)
        logger.info("Normalized %d %s articles", len(normalized), platform)

    total_fetched = len(all_normalized)
    logger.info("Total fetched: %d", total_fetched)

    # Deduplicate
    unique = deduplicate(all_normalized, existing_urls)
    deduped = total_fetched - len(unique)
    logger.info("After dedup: %d (removed %d duplicates)", len(unique), deduped)

    # Tag and score
    tagged = tag_articles(unique)
    scored = score_articles(tagged, sources_map)

    # Store in batches
    stored = 0
    for i in range(0, len(scored), BATCH_UPSERT_SIZE):
        batch = scored[i : i + BATCH_UPSERT_SIZE]
        rows = [
            {
                "title": a.title,
                "url": a.url,
                "source_id": a.source_id,
                "published_at": a.published_at.isoformat() if a.published_at else None,
                "summary_snippet": a.summary_snippet,
                "content_type": a.content_type,
                "platform": a.platform,
                "topic_tags": a.topic_tags,
                "engagement_score": a.engagement_score,
                "engagement_metrics": a.engagement_metrics,
                "recommendation_reason": a.recommendation_reason,
            }
            for a in batch
        ]
        supabase.table("articles").upsert(rows, on_conflict="url").execute()
        stored += len(batch)

    elapsed = time.time() - start_time

    logger.info("=" * 60)
    logger.info("Backfill complete in %.1fs", elapsed)
    logger.info("  Cleaned:      %d old articles", deleted_old)
    logger.info("  Fetched:      %d", total_fetched)
    logger.info("  Deduplicated: %d", deduped)
    logger.info("  Stored:       %d", stored)
    logger.info("=" * 60)


PERIOD_CONFIG: dict[str, dict[str, int]] = {
    "1month": {"weeks": 4, "days": 30},
    "3months": {"weeks": 13, "days": 90},
    "6months": {"weeks": 26, "days": 180},
    "1year": {"weeks": 52, "days": 365},
}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AI Pulse backfill pipeline")
    parser.add_argument(
        "--period",
        type=str,
        default="1month",
        choices=list(PERIOD_CONFIG.keys()),
        help="Backfill period: 1month, 3months, 6months, 1year",
    )
    args = parser.parse_args()
    asyncio.run(run_backfill(period=args.period))
