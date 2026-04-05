"""Fix RSS source URLs in Supabase — run once to update homepage URLs to actual feed URLs."""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
BASE = f"{SUPABASE_URL}/rest/v1/sources"


def update_by_name(name: str, fields: dict) -> int:
    """Update a source row by exact name match. Returns rows affected."""
    resp = httpx.patch(
        BASE,
        headers=HEADERS,
        params={"name": f"eq.{name}"},
        json=fields,
    )
    resp.raise_for_status()
    return len(resp.json())


def update_by_name_like(pattern: str, fields: dict) -> int:
    """Update source rows by LIKE pattern. Returns rows affected."""
    resp = httpx.patch(
        BASE,
        headers=HEADERS,
        params={"name": f"like.{pattern}"},
        json=fields,
    )
    resp.raise_for_status()
    return len(resp.json())


def update_by_filters(filters: dict, fields: dict) -> int:
    """Update source rows matching multiple eq filters."""
    params = {k: f"eq.{v}" for k, v in filters.items()}
    resp = httpx.patch(BASE, headers=HEADERS, params=params, json=fields)
    resp.raise_for_status()
    return len(resp.json())


def main() -> None:
    print("=== Fixing RSS feed URLs ===\n")

    # 1. Fix feed URLs (homepage → actual RSS/Atom endpoint)
    url_fixes: dict[str, str] = {
        "The Batch (Andrew Ng)": "https://www.deeplearning.ai/the-batch/feed/",
        "Import AI (Jack Clark)": "https://importai.substack.com/feed",
        "The Gradient": "https://thegradient.pub/rss/",
        "Ahead of AI (Sebastian Raschka)": "https://magazine.sebastianraschka.com/feed",
        "Jay Alammar": "https://jalammar.github.io/feed.xml",
        "VentureBeat AI": "https://venturebeat.com/feed/",
        "TechCrunch -- AI": "https://techcrunch.com/feed/",
        "Latent Space Podcast": "https://www.latent.space/feed",
        "OpenAI Blog": "https://openai.com/blog/rss.xml",
        "Microsoft Research Blog": "https://www.microsoft.com/en-us/research/feed/",
        "NVIDIA AI Blog": "https://blogs.nvidia.com/feed/",
        "Apple Machine Learning": "https://machinelearning.apple.com/rss.xml",
        "Last Week in AI Newsletter": "https://lastweekin.ai/feed",
        "AI News Roundup (TLDR)": "https://tldr.tech/ai/rss",
        "Davis Summarizes Papers": "https://dblalock.substack.com/feed",
        "Lex Fridman Podcast": "https://lexfridman.com/feed/podcast/",
        "MIT Technology Review -- AI": "https://www.technologyreview.com/feed/",
        "Ars Technica -- AI": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "The Verge -- AI": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    }

    for name, url in url_fixes.items():
        n = update_by_name(name, {"url": url})
        print(f"  Updated {name}: {n} rows")

    # LIKE-pattern names (contain apostrophes or partial matches)
    like_fixes: dict[str, str] = {
        "Simon Willison%": "https://simonwillison.net/atom/everything/",
        "Lil%Log%": "https://lilianweng.github.io/index.xml",
        "Chip Huyen%": "https://huyenchip.com/feed.xml",
        "Interconnects%": "https://www.interconnects.ai/feed",
    }

    for pattern, url in like_fixes.items():
        n = update_by_name_like(pattern, {"url": url})
        print(f"  Updated {pattern}: {n} rows")

    # 2. Convert company blogs to type=rss (they now have RSS URLs)
    print("\n=== Converting company blogs to type=rss ===\n")
    for name in [
        "OpenAI Blog",
        "Microsoft Research Blog",
        "NVIDIA AI Blog",
        "Apple Machine Learning",
    ]:
        n = update_by_name(name, {"type": "rss"})
        print(f"  Set type=rss for {name}: {n} rows")

    # 3. Pause sources that have no fetcher
    print("\n=== Pausing unfetchable sources ===\n")

    # Scrape sources — no scraper fetcher exists
    n = update_by_filters({"type": "scrape", "status": "active"}, {"status": "paused"})
    print(f"  Paused scrape sources (no scraper): {n} rows")

    # API sources with no fetcher
    api_platforms_no_fetcher = [
        "arxiv", "semantic_scholar", "papers_with_code",
        "openreview", "huggingface", "github", "lobsters",
    ]
    for platform in api_platforms_no_fetcher:
        n = update_by_filters(
            {"type": "api", "platform": platform, "status": "active"},
            {"status": "paused"},
        )
        if n:
            print(f"  Paused api/{platform}: {n} rows")

    # YouTube API sources (no fetcher)
    n = update_by_filters(
        {"type": "api", "platform": "youtube", "status": "active"},
        {"status": "paused"},
    )
    if n:
        print(f"  Paused api/youtube: {n} rows")

    # PyPI (homepage URL, not a valid feed)
    n = update_by_name_like("PyPI%", {"status": "paused"})
    if n:
        print(f"  Paused PyPI: {n} rows")

    # 4. Show final active sources
    print("\n=== Active sources after fixes ===\n")
    resp = httpx.get(
        BASE,
        headers=HEADERS,
        params={"status": "eq.active", "select": "name,url,type,platform", "order": "platform"},
    )
    resp.raise_for_status()
    for s in resp.json():
        print(f"  [{s['type']:5}] [{s['platform']:12}] {s['name']}")
    print(f"\n  Total active: {len(resp.json())}")


if __name__ == "__main__":
    main()
