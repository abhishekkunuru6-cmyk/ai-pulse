"""Best-of-year backfill: fetch high-quality AI content from March 2025 to March 2026.

Quality thresholds (balanced between quality and quantity):
  - ArXiv: Top papers per category per month (50/month/category)
  - Hacker News: Posts with 100+ points (AI-filtered)
  - Reddit: Top posts of the year from 12 AI subreddits
  - GitHub: Repos with 200+ stars
  - Semantic Scholar: Highly-cited papers (10+ citations)

Step 1: Clean up low-quality social media posts to free DB rows.
Step 2: Fetch and store best-of content through the standard pipeline.

Usage:
    PYTHONPATH=. ingestion/.venv/bin/python ingestion/backfill_yearly.py
    # Or with custom date range:
    PYTHONPATH=. ingestion/.venv/bin/python ingestion/backfill_yearly.py --start 2025-03-01 --end 2026-03-01
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import httpx
from supabase import create_client

from ingestion.config.settings import (
    BATCH_UPSERT_SIZE,
    REDDIT_USER_AGENT,
    SUPABASE_KEY,
    SUPABASE_URL,
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
logger = logging.getLogger("backfill-yearly")


# ──────────────────────────────────────────────
# AI relevance filter
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
    text = f"{title} {summary or ''}"
    return bool(AI_KEYWORDS.search(text))


# ──────────────────────────────────────────────
# Cleanup: remove low-quality social media posts
# ──────────────────────────────────────────────

def cleanup_low_quality(supabase) -> int:
    """Delete low-engagement social media posts to free DB rows.

    Removes articles where:
    - Platform is reddit or hackernews
    - Engagement score < 1.0 (low quality)
    """
    deleted_total = 0

    for platform in ("reddit", "hackernews"):
        result = (
            supabase.table("articles")
            .delete()
            .eq("platform", platform)
            .lt("engagement_score", 1.0)
            .execute()
        )
        count = len(result.data) if result.data else 0
        deleted_total += count
        logger.info("Cleaned up %d low-quality %s posts", count, platform)

    return deleted_total


# ──────────────────────────────────────────────
# ArXiv: monthly chunks, top papers per category
# ──────────────────────────────────────────────

ARXIV_API_URL = "https://export.arxiv.org/api/query"
ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.CV"]
ATOM_NS = "{http://www.w3.org/2005/Atom}"


async def backfill_arxiv(start: datetime, end: datetime) -> list[RawArticle]:
    """Fetch ArXiv papers month by month for the given date range."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    current = start
    month_num = 0
    while current < end:
        month_end = min(current + timedelta(days=30), end)
        start_str = current.strftime("%Y%m%d")
        end_str = month_end.strftime("%Y%m%d")
        month_num += 1

        for cat in ARXIV_CATEGORIES:
            query = f"cat:{cat} AND submittedDate:[{start_str} TO {end_str}]"
            logger.info(
                "ArXiv: month %d, %s (%s to %s)", month_num, cat, start_str, end_str
            )

            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(
                        ARXIV_API_URL,
                        params={
                            "search_query": query,
                            "sortBy": "relevance",
                            "sortOrder": "descending",
                            "max_results": 50,
                        },
                    )
                    resp.raise_for_status()
            except httpx.HTTPError as e:
                logger.warning("ArXiv failed for %s month %d: %s", cat, month_num, e)
                await asyncio.sleep(3)
                continue

            root = ET.fromstring(resp.text)
            for entry in root.findall(f"{ATOM_NS}entry"):
                title = (
                    (entry.findtext(f"{ATOM_NS}title") or "").strip().replace("\n", " ")
                )
                url = entry.findtext(f"{ATOM_NS}id") or ""
                published = entry.findtext(f"{ATOM_NS}published")
                summary = (
                    (entry.findtext(f"{ATOM_NS}summary") or "")
                    .strip()
                    .replace("\n", " ")
                )

                if not title or not url or url in seen_urls:
                    continue
                seen_urls.add(url)

                pub_dt = None
                if published:
                    try:
                        pub_dt = datetime.fromisoformat(
                            published.replace("Z", "+00:00")
                        )
                    except ValueError:
                        pass

                articles.append(
                    RawArticle(
                        title=title,
                        url=url,
                        published_at=pub_dt,
                        summary_snippet=summary[:300] if summary else None,
                        engagement_metrics={"category": cat},
                        extra={"backfill": True, "backfill_type": "yearly"},
                    )
                )

            await asyncio.sleep(3)

        current = month_end

    logger.info("ArXiv yearly backfill: %d articles", len(articles))
    return articles


# ──────────────────────────────────────────────
# Hacker News: monthly chunks, 100+ points
# ──────────────────────────────────────────────

HN_ALGOLIA_URL = "https://hn.algolia.com/api/v1/search"
HN_KEYWORDS = [
    "AI",
    "LLM",
    "GPT",
    "machine learning",
    "deep learning",
    "OpenAI",
    "Anthropic",
    "Claude",
    "Llama",
    "Mistral",
    "neural network",
    "transformer",
    "diffusion",
]
HN_MIN_POINTS = 100


async def backfill_hackernews(start: datetime, end: datetime) -> list[RawArticle]:
    """Fetch HN posts with 100+ points, chunked by week."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    current = start
    week_num = 0
    while current < end:
        week_end = min(current + timedelta(days=7), end)
        start_ts = int(current.timestamp())
        end_ts = int(week_end.timestamp())
        week_num += 1

        for keyword in HN_KEYWORDS:
            logger.info("HN: week %d, keyword '%s'", week_num, keyword)

            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(
                        HN_ALGOLIA_URL,
                        params={
                            "query": keyword,
                            "tags": "story",
                            "numericFilters": (
                                f"points>{HN_MIN_POINTS},"
                                f"created_at_i>{start_ts},"
                                f"created_at_i<{end_ts}"
                            ),
                            "hitsPerPage": 20,
                        },
                    )
                    resp.raise_for_status()
            except httpx.HTTPError as e:
                logger.warning("HN failed for '%s' week %d: %s", keyword, week_num, e)
                await asyncio.sleep(0.5)
                continue

            for hit in resp.json().get("hits", []):
                title = hit.get("title", "")
                if not is_ai_relevant(title):
                    continue

                url = hit.get("url") or (
                    f"https://news.ycombinator.com/item?id={hit['objectID']}"
                )
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                created_at = hit.get("created_at")
                pub_dt = None
                if created_at:
                    try:
                        pub_dt = datetime.fromisoformat(
                            created_at.replace("Z", "+00:00")
                        )
                    except ValueError:
                        pass

                articles.append(
                    RawArticle(
                        title=title,
                        url=url,
                        published_at=pub_dt,
                        summary_snippet=None,
                        engagement_metrics={
                            "points": hit.get("points", 0),
                            "comments": hit.get("num_comments", 0),
                        },
                        extra={
                            "hn_id": hit.get("objectID"),
                            "backfill": True,
                            "backfill_type": "yearly",
                        },
                    )
                )

            await asyncio.sleep(0.5)

        current = week_end

    logger.info("HN yearly backfill: %d articles (AI-filtered, %d+ pts)", len(articles), HN_MIN_POINTS)
    return articles


# ──────────────────────────────────────────────
# Reddit: top posts of the year
# ──────────────────────────────────────────────

REDDIT_PUBLIC_BASE = "https://www.reddit.com"
REDDIT_SUBREDDITS = [
    "MachineLearning",
    "LocalLLaMA",
    "artificial",
    "singularity",
    "deeplearning",
    "ChatGPT",
    "OpenAI",
    "StableDiffusion",
    "ArtificialIntelligence",
    "PromptEngineering",
    "LangChain",
    "ClaudeAI",
]
AI_SUBREDDITS = {
    "MachineLearning",
    "LocalLLaMA",
    "deeplearning",
    "ChatGPT",
    "OpenAI",
    "StableDiffusion",
    "LangChain",
    "ClaudeAI",
}


async def backfill_reddit() -> list[RawArticle]:
    """Fetch top posts of the year from all tracked subreddits."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    for sub in REDDIT_SUBREDDITS:
        logger.info("Reddit: fetching r/%s /top?t=year", sub)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{REDDIT_PUBLIC_BASE}/r/{sub}/top.json",
                    headers={"User-Agent": REDDIT_USER_AGENT},
                    params={"t": "year", "limit": 100, "raw_json": 1},
                )
                resp.raise_for_status()

            for child in resp.json().get("data", {}).get("children", []):
                post = child.get("data", {})
                if post.get("stickied"):
                    continue

                title = post.get("title", "")

                if sub not in AI_SUBREDDITS and not is_ai_relevant(title):
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
                    if created_utc
                    else None
                )

                selftext = post.get("selftext", "")
                snippet = (
                    (selftext[:300] + "...") if len(selftext) > 300 else selftext
                ) if selftext else None

                articles.append(
                    RawArticle(
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
                        extra={
                            "reddit_id": post.get("id"),
                            "backfill": True,
                            "backfill_type": "yearly",
                        },
                    )
                )
        except httpx.HTTPError as e:
            logger.warning("Reddit r/%s failed: %s", sub, e)

        await asyncio.sleep(2)

    logger.info("Reddit yearly backfill: %d articles", len(articles))
    return articles


# ──────────────────────────────────────────────
# GitHub: repos with 200+ stars, monthly chunks
# ──────────────────────────────────────────────

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"
GITHUB_QUERIES = [
    "machine learning",
    "LLM",
    "AI agent",
    "deep learning",
    "diffusion model",
    "transformer",
    "GPT",
    "RAG retrieval",
]
GITHUB_MIN_STARS = 200


async def backfill_github(start: datetime, end: datetime) -> list[RawArticle]:
    """Fetch AI/ML repos with 200+ stars, chunked by quarter."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    current = start
    chunk_num = 0
    while current < end:
        chunk_end = min(current + timedelta(days=90), end)
        since_str = current.strftime("%Y-%m-%d")
        until_str = chunk_end.strftime("%Y-%m-%d")
        chunk_num += 1

        for query in GITHUB_QUERIES:
            search_q = (
                f"{query} pushed:{since_str}..{until_str} "
                f"stars:>={GITHUB_MIN_STARS}"
            )
            logger.info("GitHub: chunk %d, query '%s'", chunk_num, query)

            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(
                        GITHUB_SEARCH_URL,
                        params={
                            "q": search_q,
                            "sort": "stars",
                            "order": "desc",
                            "per_page": 30,
                        },
                        headers={"Accept": "application/vnd.github.v3+json"},
                    )
                    resp.raise_for_status()
            except httpx.HTTPError as e:
                logger.warning("GitHub '%s' chunk %d failed: %s", query, chunk_num, e)
                await asyncio.sleep(7)
                continue

            for repo in resp.json().get("items", []):
                url = repo.get("html_url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                pushed = repo.get("pushed_at")
                pub_dt = None
                if pushed:
                    try:
                        pub_dt = datetime.fromisoformat(
                            pushed.replace("Z", "+00:00")
                        )
                    except ValueError:
                        pass

                articles.append(
                    RawArticle(
                        title=(
                            f"{repo.get('full_name', '')} — "
                            f"{repo.get('description', 'No description')}"
                        )[:200],
                        url=url,
                        published_at=pub_dt,
                        summary_snippet=repo.get("description"),
                        engagement_metrics={
                            "stars": repo.get("stargazers_count", 0),
                            "forks": repo.get("forks_count", 0),
                            "language": repo.get("language"),
                        },
                        extra={
                            "topics": repo.get("topics", []),
                            "backfill": True,
                            "backfill_type": "yearly",
                        },
                    )
                )

            await asyncio.sleep(7)

        current = chunk_end

    logger.info("GitHub yearly backfill: %d articles (%d+ stars)", len(articles), GITHUB_MIN_STARS)
    return articles


# ──────────────────────────────────────────────
# Semantic Scholar: highly-cited papers
# ──────────────────────────────────────────────

S2_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
S2_FIELDS = (
    "title,url,abstract,year,citationCount,influentialCitationCount,"
    "authors,tldr,publicationDate,externalIds"
)
S2_QUERIES = [
    "large language model",
    "deep learning",
    "transformer neural network",
    "reinforcement learning",
    "computer vision",
    "AI alignment safety",
    "multimodal model",
    "diffusion model",
]
S2_MIN_CITATIONS = 10


async def backfill_semantic_scholar(start: datetime, end: datetime) -> list[RawArticle]:
    """Fetch highly-cited AI papers from Semantic Scholar."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    start_year = start.year
    end_year = end.year
    year_range = f"{start_year}-{end_year}"

    for i, query in enumerate(S2_QUERIES):
        if i > 0:
            await asyncio.sleep(3)

        logger.info("Semantic Scholar: query '%s' (%s)", query, year_range)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    S2_API_URL,
                    params={
                        "query": query,
                        "limit": 50,
                        "fields": S2_FIELDS,
                        "sort": "citationCount:desc",
                        "year": year_range,
                    },
                )
                if resp.status_code == 429:
                    logger.warning("S2 rate-limited for: %s", query)
                    await asyncio.sleep(10)
                    continue
                resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("S2 failed for '%s': %s", query, e)
            continue

        for paper in resp.json().get("data", []):
            title = paper.get("title", "").strip()
            citations = paper.get("citationCount", 0) or 0
            if not title or citations < S2_MIN_CITATIONS:
                continue

            paper_url = paper.get("url", "")
            if not paper_url:
                paper_id = paper.get("paperId", "")
                if paper_id:
                    paper_url = f"https://www.semanticscholar.org/paper/{paper_id}"
                else:
                    continue

            if paper_url in seen_urls:
                continue
            seen_urls.add(paper_url)

            tldr = paper.get("tldr")
            snippet = tldr.get("text") if isinstance(tldr, dict) else None
            if not snippet:
                abstract = paper.get("abstract", "")
                snippet = (abstract[:400] + "...") if abstract and len(abstract) > 400 else abstract

            pub_date_str = paper.get("publicationDate")
            pub_dt = None
            if pub_date_str:
                try:
                    pub_dt = datetime.strptime(pub_date_str, "%Y-%m-%d").replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    pass

            authors = [
                a.get("name", "") for a in (paper.get("authors") or [])[:5]
            ]
            external_ids = paper.get("externalIds") or {}

            articles.append(
                RawArticle(
                    title=title,
                    url=paper_url,
                    published_at=pub_dt,
                    summary_snippet=snippet,
                    engagement_metrics={
                        "citations": citations,
                        "influential_citations": paper.get(
                            "influentialCitationCount", 0
                        ),
                    },
                    extra={
                        "authors": authors,
                        "arxiv_id": external_ids.get("ArXiv"),
                        "doi": external_ids.get("DOI"),
                        "year": paper.get("year"),
                        "backfill": True,
                        "backfill_type": "yearly",
                    },
                )
            )

    logger.info(
        "S2 yearly backfill: %d articles (%d+ citations)",
        len(articles),
        S2_MIN_CITATIONS,
    )
    return articles


# ──────────────────────────────────────────────
# Main orchestrator
# ──────────────────────────────────────────────

async def run_yearly_backfill(start: datetime, end: datetime) -> None:
    """Run the full yearly backfill pipeline."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Load sources
    result = supabase.table("sources").select("*").eq("status", "active").execute()
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
        if src.platform not in platform_source_map:
            platform_source_map[src.platform] = src

    sources_map = {s.id: s for s in platform_source_map.values()}

    # Step 1: Clean up low-quality social media posts
    logger.info("=" * 60)
    logger.info("Step 1: Cleaning up low-quality social media posts")
    logger.info("=" * 60)
    cleaned = cleanup_low_quality(supabase)
    logger.info("Cleaned %d low-quality posts", cleaned)

    # Load existing URLs for dedup (full range since we're backfilling a year)
    url_result = supabase.table("articles").select("url").execute()
    existing_urls = {row["url"] for row in url_result.data}
    logger.info("Existing articles in DB: %d", len(existing_urls))

    # Step 2: Fetch from all sources
    logger.info("=" * 60)
    logger.info(
        "Step 2: Fetching best-of content (%s to %s)",
        start.strftime("%Y-%m-%d"),
        end.strftime("%Y-%m-%d"),
    )
    logger.info("=" * 60)

    start_time = time.time()

    arxiv_raw = await backfill_arxiv(start, end)
    hn_raw = await backfill_hackernews(start, end)
    reddit_raw = await backfill_reddit()
    github_raw = await backfill_github(start, end)
    s2_raw = await backfill_semantic_scholar(start, end)

    # Normalize each batch
    all_normalized: list[NormalizedArticle] = []

    for platform, raw_articles in [
        ("arxiv", arxiv_raw),
        ("hackernews", hn_raw),
        ("reddit", reddit_raw),
        ("github", github_raw),
        ("semantic_scholar", s2_raw),
    ]:
        source = platform_source_map.get(platform)
        if not source:
            logger.warning(
                "No source for platform %s, skipping %d articles",
                platform,
                len(raw_articles),
            )
            continue
        normalized = normalize(raw_articles, source)
        all_normalized.extend(normalized)
        logger.info("Normalized %d %s articles", len(normalized), platform)

    total_fetched = len(all_normalized)
    logger.info("Total fetched: %d", total_fetched)

    # Deduplicate
    unique = deduplicate(all_normalized, existing_urls)
    deduped_count = total_fetched - len(unique)
    logger.info("After dedup: %d (removed %d duplicates)", len(unique), deduped_count)

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
        if stored % 200 == 0:
            logger.info("  Stored %d / %d ...", stored, len(scored))

    elapsed = time.time() - start_time

    logger.info("=" * 60)
    logger.info("Yearly backfill complete in %.1fs (%.1f min)", elapsed, elapsed / 60)
    logger.info("  Cleaned:      %d low-quality posts", cleaned)
    logger.info("  Fetched:      %d", total_fetched)
    logger.info("  Deduplicated: %d", deduped_count)
    logger.info("  Stored:       %d new articles", stored)
    logger.info("=" * 60)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Best-of-year backfill")
    parser.add_argument(
        "--start",
        type=str,
        default="2025-03-01",
        help="Start date (YYYY-MM-DD), default: 2025-03-01",
    )
    parser.add_argument(
        "--end",
        type=str,
        default="2026-03-01",
        help="End date (YYYY-MM-DD), default: 2026-03-01",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    start_dt = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end_dt = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    asyncio.run(run_yearly_backfill(start_dt, end_dt))
