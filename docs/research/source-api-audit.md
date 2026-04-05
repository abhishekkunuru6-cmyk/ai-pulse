# Source API Feasibility Audit

> **Date:** 2026-03-15
> **Purpose:** Verify current API availability, rate limits, auth requirements, and feasibility for the LLM News Aggregator project.
> **Goal:** Confirm a $0/month operational cost is achievable.

---

## Priority 1 -- Backbone Sources (Must work day 1)

| # | Source | API / Method | Auth Required | Free Tier Limits | Data Format | Key Fields | Feasibility | Notes |
|---|--------|-------------|---------------|-----------------|-------------|------------|-------------|-------|
| 1 | **Hacker News** | Algolia Search API (`hn.algolia.com/api/v1`) | None | 10,000 req/hour per IP | JSON | `title`, `url`, `author`, `points`, `num_comments`, `created_at`, `objectID`, `story_text` | EASY | Fully public, no auth needed. Endpoints: `/search` (by relevance), `/search_by_date` (chronological), `/items/:id`, `/users/:username`. Supports tag filters (`story`, `comment`, `poll`), pagination (`page`, `hitsPerPage`). Rock-solid uptime. |
| 2 | **Reddit** | Reddit OAuth API (`oauth.reddit.com`) | Yes -- OAuth 2.0 | 100 req/min (free tier) | JSON | `title`, `selftext`, `url`, `score`, `num_comments`, `created_utc`, `subreddit`, `author`, `permalink` | MODERATE | OAuth 2.0 mandatory for all access (unauthenticated blocked). Free tier restricted to non-commercial use. Target subreddits: `r/MachineLearning`, `r/LocalLLaMA`, `r/artificial`. Register a "script" app at reddit.com/prefs/apps. 2024+ policy requires pre-approval for some use cases. |
| 3 | **RSS Feeds (generic)** | Standard RSS/Atom parsers | None | Unlimited (per-source politeness) | XML (RSS 2.0 / Atom 1.0) | `title`, `link`, `description`, `pubDate`, `author`, `category` | EASY | Universal standard. Use `feedparser` (Python) or similar. Respect `<ttl>` and cache headers. Poll every 15-60 min per feed. No API keys, no auth, no cost. |
| 4 | **ArXiv** | ArXiv API (`export.arxiv.org/api/query`) | None | 1 request per 3 seconds | XML (Atom 1.0) | `title`, `summary`, `author`, `published`, `updated`, `category`, `id` (arXiv ID), `link` (PDF) | EASY | Free, no auth. Query by category (`cat:cs.AI`, `cat:cs.CL`, `cat:cs.LG`), author, title, abstract. Max 2,000 results per request, 30,000 total per query via pagination (`start`, `max_results`). Rate limit is generous for daily polling. Python wrapper: `arxiv` package on PyPI. |

---

## Priority 2 -- High Value Sources

| # | Source | API / Method | Auth Required | Free Tier Limits | Data Format | Key Fields | Feasibility | Notes |
|---|--------|-------------|---------------|-----------------|-------------|------------|-------------|-------|
| 5 | **GitHub** | GitHub REST API v3 (`api.github.com`) | Optional (recommended) | Unauth: 60 req/hr; Auth: 5,000 req/hr | JSON | `full_name`, `description`, `stargazers_count`, `forks_count`, `language`, `created_at`, `updated_at`, `topics` | EASY | Free personal access token gives 5,000 req/hr. No official trending endpoint -- use `/search/repositories?q=stars:>100+created:>2026-03-14&sort=stars` or scrape `github.com/trending`. Releases endpoint: `/repos/:owner/:repo/releases`. |
| 6 | **HuggingFace** | HuggingFace Hub API (`huggingface.co/api`) | Optional (token for higher limits) | Undocumented but generous for metadata | JSON | `modelId`, `pipeline_tag`, `downloads`, `likes`, `lastModified`, `tags`, `library_name`, `author` | EASY | Endpoints: `/api/models` (list/search models), `/api/datasets`, `/api/spaces`, `/api/daily_papers`. No auth needed for public metadata. Free tier is sufficient for periodic polling. HuggingFace Daily Papers endpoint is especially useful for LLM news. |
| 7 | **YouTube** | YouTube Data API v3 | Yes -- API key (Google Cloud) | 10,000 units/day | JSON | `snippet.title`, `snippet.description`, `snippet.channelTitle`, `snippet.publishedAt`, `statistics.viewCount`, `contentDetails.duration` | MODERATE | Free 10,000 units/day quota. Search costs 100 units (so ~100 searches/day). Video details cost 1 unit. Requires Google Cloud project + API key (free). Monitor AI/ML channels via channel-specific playlist queries (cheaper than search). |
| 8 | **Semantic Scholar** | Semantic Scholar API (`api.semanticscholar.org/graph/v1`) | Optional (API key for higher limits) | Unauth: 5,000 req/5min (shared pool); Auth: 1 req/sec | JSON | `paperId`, `title`, `abstract`, `authors`, `year`, `citationCount`, `venue`, `fieldsOfStudy`, `openAccessPdf`, `tldr` | EASY | Free, non-profit. API key available on request for stable rate limits. Excellent `tldr` field provides AI-generated paper summaries. Endpoints: `/paper/search`, `/paper/:id`, `/paper/batch`. Covers 200M+ papers. |
| 9 | **Papers With Code** | Papers With Code API (`paperswithcode.com/api/v1`) | None (read); Token (write) | Undocumented; generous for reads | JSON | `title`, `abstract`, `url_pdf`, `url_abs`, `proceeding`, `tasks`, `methods`, `repositories` | EASY | Free public API. Python client: `paperswithcode-client` on PyPI. Endpoints: `paper_list()`, `paper_dataset_list()`, `paper_repository_list()`. Links papers to code repos -- unique value prop. Read access needs no token. |

---

## Priority 3 -- Nice to Have

| # | Source | API / Method | Auth Required | Free Tier Limits | Data Format | Key Fields | Feasibility | Notes |
|---|--------|-------------|---------------|-----------------|-------------|------------|-------------|-------|
| 10 | **X/Twitter** | X API v2 (`api.x.com/2`) | Yes -- OAuth 2.0 | Free: 500 posts + 100 reads/month | JSON | `text`, `author_id`, `created_at`, `public_metrics`, `entities.urls` | HARD | Free tier is nearly useless (100 reads/month). Basic tier is $100-200/month. New pay-as-you-go option launched Feb 2026 but still expensive. Not viable at $0/month. Consider RSS-bridge or Nitter alternatives (unreliable). |
| 11 | **LinkedIn** | LinkedIn API | Yes -- Partner approval | Partners only; no individual dev access | JSON | N/A | SKIP | Requires incorporated company + LinkedIn Partner approval. No free developer access. Scraping violates ToS and triggers aggressive anti-bot measures. Not viable for this project. |
| 12 | **Lobsters** | JSON endpoints (`lobste.rs/*.json`) + RSS | None | No documented limits; be polite | JSON / RSS | `title`, `url`, `score`, `comment_count`, `created_at`, `submitter_user`, `tags` | EASY | Append `.json` to any page URL. Hottest: `lobste.rs/.json`, Newest: `lobste.rs/newest.json`. Per-tag RSS: `lobste.rs/t/ai.rss`. No auth, no rate limit docs -- just be polite (1 req/10s). Small but high-quality community. |
| 13 | **Discord** | Discord Bot API (`discord.com/api/v10`) | Yes -- Bot token | 50 req/sec global | JSON | `content`, `author`, `timestamp`, `channel_id`, `attachments`, `embeds` | MODERATE | Free, no usage fees. Requires bot token + server invite permissions. Must be added to each target server. Useful for monitoring AI Discord communities (e.g., Nous Research, EleutherAI, Stability AI). Needs server admin cooperation. |
| 14 | **Google Scholar** | No official API | N/A | N/A | N/A | N/A | SKIP | No official API. Scraping violates ToS and triggers CAPTCHAs. Third-party services (SerpAPI, ScraperAPI) cost $50-275/month. Use Semantic Scholar as free alternative. |
| 15 | **OpenReview** | OpenReview API (`api2.openreview.net`) | Optional (for write) | Undocumented; reasonable for reads | JSON | `title`, `abstract`, `authors`, `venue`, `decision`, `rating`, `confidence` | MODERATE | Free REST API. Python client: `openreview-py`. Covers top ML venues (NeurIPS, ICLR, ICML). Useful for tracking paper acceptances and reviews. Rate limits not publicly documented -- use conservative polling. |
| 16 | **PyPI** | PyPI JSON API (`pypi.org/pypi/:package/json`) | None | No hard rate limit (CDN-cached) | JSON | `name`, `version`, `summary`, `author`, `home_page`, `release_url`, `requires_python`, `project_urls` | EASY | Free, no auth. Heavily cached via CDN. Use RSS feed at `pypi.org/rss/updates.xml` for new releases. Also: `pypi.org/rss/packages.xml` for new packages. Set a proper `User-Agent`. Great for tracking new AI/ML library releases. |
| 17 | **Ollama Library** | Community API (`ollamadb.dev/api/v1`) + website scraping | None | Undocumented | JSON | `name`, `description`, `tags`, `size`, `updated` | MODERATE | No official public API for the model library at `ollama.com/library`. Community-maintained API at `ollamadb.dev/api/v1` provides model listings. Alternatively, scrape the library page. Local Ollama API (`localhost:11434/api/tags`) only lists locally installed models. |

---

## Company/Lab Blog RSS Availability

| Organization | Blog URL | RSS Feed URL | Status | Notes |
|-------------|----------|-------------|--------|-------|
| **OpenAI** | `openai.com/news` | `https://openai.com/news/rss.xml` | Available | Official RSS feed. Previously at `/blog/rss.xml` (redirects). |
| **Anthropic** | `anthropic.com/research` | Not officially published | Partial | No native RSS. Community-generated feeds via RSSHub (`rsshub.app/anthropic`). Consider building a lightweight scraper. |
| **DeepMind** | `deepmind.google/discover/blog` | Not officially published | Partial | No native RSS found. Use RSSHub or similar feed generator. Google Research blog (`blog.research.google/feeds/posts/default`) may cover some content. |
| **Meta AI** | `ai.meta.com/blog` | Not officially published | Partial | No native RSS. Use RSSHub route or scrape. Meta's engineering blog has a feed but AI-specific one does not. |
| **Microsoft Research** | `microsoft.com/en-us/research/blog` | `https://www.microsoft.com/en-us/research/feed/` | Available | Official RSS feed. Covers all MS Research areas -- filter for AI/ML topics. |
| **Mistral** | `mistral.ai/news` | Not officially published | Partial | No native RSS. Community feeds available via RSSHub. Low posting frequency makes polling viable. |
| **NVIDIA AI** | `blogs.nvidia.com` | `https://blogs.nvidia.com/feed/` | Available | Official RSS. Also: `developer.nvidia.com/blog/feed/` for developer blog. Filter for AI/Deep Learning tags. |
| **Apple ML** | `machinelearning.apple.com` | `https://machinelearning.apple.com/rss.xml` | Available | Official RSS feed. Low frequency (~1-2 posts/month) but high quality. |

**RSS workaround for blogs without feeds:** Use RSSHub (`docs.rsshub.app`), a community-maintained open-source project that generates RSS feeds for websites that do not natively support them. Self-hostable at $0/month.

---

## Individual Blog/Newsletter RSS

| Blog / Newsletter | Author | RSS Feed URL | Status | Notes |
|------------------|--------|-------------|--------|-------|
| **Simon Willison's Weblog** | Simon Willison | `https://simonwillison.net/atom/everything/` | Available | Extremely prolific. Covers LLMs, AI tools, open source. High signal. |
| **Lil'Log** | Lilian Weng (OpenAI) | `https://lilianweng.github.io/feed.xml` | Available | Jekyll-generated Atom feed. Deep technical posts on ML/AI concepts. Lower frequency. |
| **Chip Huyen's Blog** | Chip Huyen | `https://huyenchip.com/feed.xml` | Available | Covers MLOps, LLMs, AI engineering. |
| **The Batch** | Andrew Ng / DeepLearning.AI | `https://www.deeplearning.ai/the-batch/feed/` | Likely Available | Weekly newsletter. May require kill-the-newsletter or RSSHub for reliable feed. Check directly. |
| **Import AI** | Jack Clark | `https://importai.substack.com/feed` | Available | Substack-hosted. All Substack newsletters have `/feed` endpoint. Weekly AI research roundup. |
| **The Gradient** | The Gradient Pub | `https://thegradient.pub/rss/` | Available | Ghost-hosted blog. Standard Ghost RSS. Academic-leaning AI content. |
| **Latent Space** | Swyx & Alessio | `https://www.latent.space/feed` | Available | Substack-hosted. AI engineering podcast + newsletter. Very active community. |
| **Ahead of AI** | Sebastian Raschka | `https://magazine.sebastianraschka.com/feed` | Available | Substack-hosted. Deep dives into LLM research. Monthly-ish cadence. |

---

## Summary

### 1. Feasibility Counts

| Rating | Count | Sources |
|--------|-------|---------|
| **EASY** | 10 | Hacker News, RSS Feeds, ArXiv, GitHub, HuggingFace, Semantic Scholar, Papers With Code, Lobsters, PyPI, (most RSS blogs) |
| **MODERATE** | 5 | Reddit, YouTube, Discord, OpenReview, Ollama Library |
| **HARD** | 1 | X/Twitter |
| **SKIP** | 2 | LinkedIn, Google Scholar |

### 2. Recommended Phase 1 Sources (Easiest to Implement First)

**Wave 1 -- Week 1 (zero auth, immediate value):**
1. **Hacker News** (Algolia API) -- No auth, JSON, excellent for real-time AI news
2. **ArXiv** (API) -- No auth, XML/Atom, daily paper tracking for `cs.AI`, `cs.CL`, `cs.LG`
3. **RSS Feeds** (blogs/newsletters) -- No auth, universal, covers 8+ high-quality sources immediately
4. **Lobsters** -- No auth, JSON, small but curated

**Wave 2 -- Week 2 (simple auth):**
5. **HuggingFace Hub API** -- No auth for reads, daily papers + trending models
6. **Papers With Code** -- No auth for reads, paper-to-code linkage
7. **Semantic Scholar** -- No auth (or free API key), AI-generated TLDRs
8. **PyPI** -- No auth, RSS for new AI/ML packages

**Wave 3 -- Week 3 (OAuth / API key setup):**
9. **GitHub** -- Free personal access token, trending AI repos + releases
10. **Reddit** -- OAuth 2.0 required, three key subreddits
11. **YouTube** -- Google Cloud API key, AI/ML channel monitoring

**Wave 4 -- Later (if needed):**
12. **OpenReview** -- Conference paper tracking
13. **Discord** -- Community monitoring (needs server permissions)
14. **Ollama Library** -- Model release tracking

### 3. Cost Analysis -- $0/Month Is Achievable

| Item | Cost | Notes |
|------|------|-------|
| Hacker News API | $0 | Free, no auth |
| ArXiv API | $0 | Free, no auth |
| RSS feed parsing | $0 | Free standard, no auth |
| Reddit API | $0 | Free tier (non-commercial, 100 req/min) |
| GitHub API | $0 | Free tier (5,000 req/hr with token) |
| HuggingFace Hub API | $0 | Free for metadata queries |
| YouTube Data API v3 | $0 | Free 10,000 units/day (Google Cloud) |
| Semantic Scholar API | $0 | Free, non-profit |
| Papers With Code API | $0 | Free for reads |
| Lobsters | $0 | Free, no auth |
| PyPI JSON API | $0 | Free, CDN-cached |
| OpenReview API | $0 | Free for reads |
| Discord Bot API | $0 | Free, no usage fees |
| RSSHub (self-hosted) | $0 | Open source, self-host for missing feeds |
| **Total** | **$0/month** | All Phase 1-3 sources are free tier |

**Key risks to the $0 target:**
- Reddit may tighten free tier restrictions further (monitor their developer announcements)
- YouTube quota (10,000 units/day) is sufficient but could become tight if search-heavy; prefer channel-based polling over search
- X/Twitter is not viable at $0 -- skip entirely or use community RSS bridges (unreliable)

**Conclusion:** A fully functional LLM news aggregator covering 12+ high-quality sources is achievable at $0/month using only free API tiers, public RSS feeds, and open-source tooling.
