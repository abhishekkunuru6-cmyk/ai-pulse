# CLAUDE.md — AI Pulse

## Problem Statement

The AI field evolves at an overwhelming pace — new research papers, GitHub repos, products, and models drop weekly. Missing even two weeks means falling significantly behind. There's no single platform that consolidates all relevant AI developments in a personalized way.

---

## Vision

A personal AI news aggregator website that acts as a single source of truth for everything happening in AI that matters *to me*.

### Core Principle: Discover, Rank, and Link — Never Store Content

This website is **not** a content warehouse. It does **not** store, copy, or cache article content. Its job is strictly:

1. **Discover** — find the best sources and surface relevant articles
2. **Rank** — order them by quality, relevance, and user preference
3. **Show** — display titles, summaries, and metadata with a direct link to the original source

The user always reads the article at its original URL. The website stores only metadata (title, URL, source, timestamp, summary snippet, user rating) — never the full article body. This keeps the system lightweight, avoids copyright concerns, and ensures the user always gets the freshest version from the source.

---

## Design Principles

### Mobile-First, Modern UI
- **Mobile-friendliness is the top priority** — the primary use case is browsing on a phone while traveling
- Fully responsive design that works seamlessly on mobile phones, tablets, and laptops
- Extremely modern interface — clean, fast, minimal, and intuitive
- Touch-friendly interactions (swipe, tap, pull-to-refresh)
- Fast load times on mobile networks (lazy loading, optimized assets)
- Progressive Web App (PWA) considerations for offline reading

### Quality Over Quantity
- Sources go through a rating gate (4+ stars) before they enter the feed
- Nothing is auto-added — every source requires explicit user approval
- Anti-noise filters per platform to keep the feed clean

### Plan Before Build
- Never implement without a written plan
- Every phase starts with planning and user preference confirmation
- Build in phases with sub-phases — no big-bang releases

---

## Tech Stack (All Free Tier)

| Layer | Technology | Free Tier Limits |
|---|---|---|
| **Frontend + API** | Next.js (App Router) on Vercel | 100GB bandwidth, serverless functions |
| **Styling** | Tailwind CSS | Open source, no limits |
| **Database** | Supabase (Postgres) | 500MB storage, 50K rows, built-in auth |
| **Caching** | Upstash Redis | 10K commands/day, 256MB |
| **Data Ingestion** | Python scripts via GitHub Actions (scheduled) | 2000 min/month (private), unlimited (public) |
| **CI/CD** | GitHub Actions | Same as above |
| **Hosting** | Vercel (`.vercel.app` subdomain) | Free, global CDN |

### Two-Service Architecture

```
┌──────────────────────────┐     ┌──────────────────────────┐
│      Vercel (Free)       │     │  GitHub Actions (Free)   │
│                          │     │                          │
│  Next.js App Router      │     │  Python Ingestion Workers │
│  ├── Pages (SSR + CSR)   │     │  ├── API fetchers        │
│  ├── API Routes          │     │  ├── RSS fetchers        │
│  └── Tailwind CSS        │     │  ├── Scrape fetchers     │
│                          │     │  ├── Normalizer          │
│          │               │     │  ├── Deduplicator        │
│          ▼               │     │  └── Tagger / Scorer     │
│  ┌──────────────────┐    │     │          │               │
│  │  Upstash Redis   │◄───┼─────┼──────────┘               │
│  │  (Cache, Free)   │    │     │                          │
│  └──────────────────┘    │     │                          │
│          │               │     │          │               │
│          ▼               │     │          ▼               │
│  ┌──────────────────┐    │     │  ┌──────────────────┐    │
│  │  Supabase        │◄───┼─────┼──┤  Supabase        │    │
│  │  (Postgres, Free)│    │     │  │  (Postgres, Free)│    │
│  └──────────────────┘    │     │  └──────────────────┘    │
└──────────────────────────┘     └──────────────────────────┘
```

**Total cost: $0/month.** X API ($100/mo) is skipped; X content via curated RSS alternatives or manual curation.

---

## Content Sources to Track

### Research & Papers
| Source | Examples / URLs | Type |
|---|---|---|
| ArXiv — AI/ML sections | arxiv.org/list/cs.AI, cs.LG, cs.CL, cs.CV | Papers |
| Semantic Scholar | semanticscholar.org | Paper search & citation tracking |
| Papers With Code | paperswithcode.com | Papers + code + benchmarks |
| Google Scholar Alerts | scholar.google.com | Author/topic tracking |
| OpenReview | openreview.net | Conference submissions & reviews |
| Hugging Face Papers | huggingface.co/papers | Daily curated papers |

### Social & Community
| Source | Examples / URLs | Type |
|---|---|---|
| X (Twitter) | Curated list of AI accounts | Posts, threads |
| LinkedIn | AI professionals, company pages | Posts, articles |
| Reddit | r/MachineLearning, r/LocalLLaMA, r/artificial, r/singularity | Discussions |
| Hacker News | news.ycombinator.com | AI-tagged posts |
| Lobsters | lobste.rs (ai, ml tags) | Technical discussions |
| Discord communities | Midjourney, Stability AI, EleutherAI servers | Announcements |

### Code & Open Source
| Source | Examples / URLs | Type |
|---|---|---|
| GitHub Trending | github.com/trending (ML/AI topics) | Repos |
| GitHub Releases | Tracked repos' release pages | New versions |
| Hugging Face Models | huggingface.co/models | New model uploads |
| Hugging Face Spaces | huggingface.co/spaces | Demos |
| PyPI / npm | New AI-related packages | Libraries |
| Ollama Library | ollama.com/library | Local model releases |

### News & Blogs
| Source | Examples / URLs | Type |
|---|---|---|
| The Batch (Andrew Ng) | deeplearning.ai/the-batch | Newsletter |
| Import AI (Jack Clark) | importai.net | Newsletter |
| The Gradient | thegradient.pub | Long-form analysis |
| AI News (Sebastian Raschka) | magazine.sebastianraschka.com | Newsletter |
| Ahead of AI (Sebastian Raschka) | Substack | Newsletter |
| Simon Willison's Blog | simonwillison.net | Blog |
| Lil'Log (Lilian Weng) | lilianweng.github.io | Blog |
| Jay Alammar | jalammar.github.io | Visual explainers |
| Chip Huyen | huyenchip.com | Blog |
| MIT Technology Review — AI | technologyreview.com/ai | News |
| VentureBeat AI | venturebeat.com/ai | News |
| The Verge — AI | theverge.com/ai-artificial-intelligence | News |
| Ars Technica — AI | arstechnica.com/ai | News |
| TechCrunch — AI | techcrunch.com/category/artificial-intelligence | News |

### Companies & Labs
| Source | Examples / URLs | Type |
|---|---|---|
| OpenAI Blog | openai.com/blog | Announcements |
| Anthropic Research | anthropic.com/research | Papers, updates |
| Google DeepMind Blog | deepmind.google/research | Research |
| Meta AI Blog | ai.meta.com/blog | Research, releases |
| Microsoft Research | microsoft.com/en-us/research/blog | Research |
| Mistral AI Blog | mistral.ai/news | Announcements |
| Cohere Blog | cohere.com/blog | Product, research |
| Stability AI | stability.ai/news | Announcements |
| NVIDIA AI Blog | blogs.nvidia.com/blog/category/deep-learning | Hardware, models |
| Apple Machine Learning | machinelearning.apple.com | Research |
| xAI | x.ai | Announcements |

### Conferences & Events
| Source | Examples / URLs | Type |
|---|---|---|
| NeurIPS | neurips.cc | Conference |
| ICML | icml.cc | Conference |
| ICLR | iclr.cc | Conference |
| AAAI | aaai.org | Conference |
| CVPR | cvpr.thecvf.com | Conference (vision) |
| ACL | aclweb.org | Conference (NLP) |
| EMNLP | emnlp.org | Conference (NLP) |
| AI Engineer Summit | ai.engineer | Conference (applied) |

### People to Follow
| Source | Examples | Type |
|---|---|---|
| Top Researchers | Yann LeCun, Andrej Karpathy, Ilya Sutskever, Fei-Fei Li, Geoffrey Hinton | Individual |
| AI Influencers / Educators | Andrew Ng, Sebastian Raschka, Chip Huyen, Jeremy Howard | Individual |
| AI Product Builders | Sam Altman, Dario Amodei, Emad Mostaque, Clem Delangue | Individual |

### Benchmarks & Leaderboards
| Source | Examples / URLs | Type |
|---|---|---|
| LMSYS Chatbot Arena | lmarena.ai | LLM rankings |
| Open LLM Leaderboard | huggingface.co/spaces/open-llm-leaderboard | Benchmarks |
| Artificial Analysis | artificialanalysis.ai | Price/performance |
| LLM Benchmark Hub | Various | Standardized evals |

### Podcasts & Video
| Source | Examples / URLs | Type |
|---|---|---|
| Lex Fridman Podcast | lexfridman.com/podcast | Long interviews |
| Machine Learning Street Talk | youtube.com/@MachineLearningStreetTalk | Technical discussions |
| Yannic Kilcher | youtube.com/@YannicKilcher | Paper reviews |
| Two Minute Papers | youtube.com/@TwoMinutePapers | Paper summaries |
| Latent Space Podcast | latent.space | Engineering-focused |
| No Priors | youtube.com/@NoPriorsPodcast | Industry interviews |

> Open to adding more sources as the project evolves.

---

## Source Management System

The quality of the website is only as good as the quality of its sources. The system must make sources a first-class, manageable entity.

### Source as a Data Object

Every source stored in the system should have:

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `url` | Direct URL to the source |
| `category` | Research, Social, Code, News, Company, etc. |
| `type` | RSS feed, API, Web scrape, Manual |
| `status` | Active, Paused, Deprecated |
| `added_on` | Date the source was added |
| `last_fetched` | Last time content was pulled |
| `fetch_frequency` | How often to check (hourly, daily, weekly) |
| `reliability_score` | Quality/relevance rating (auto + manual) |
| `notes` | Free-text notes on why this source matters |

### Source CRUD Operations

- **Add** — add a new source with URL, category, and fetch frequency
- **Edit** — update any field (URL changed, rename, recategorize)
- **Pause** — temporarily stop fetching without deleting
- **Deprecate** — mark as irrelevant; stop fetching, keep historical data
- **Delete** — permanently remove source and optionally its content
- **Bulk import/export** — import a list of sources from CSV/JSON; export for backup

### Source Quality & Relevance

- **Auto-scoring**: Track how often articles from a source get thumbs-up vs thumbs-down; sources with consistently low engagement get flagged
- **Manual review**: Periodic prompt to review sources marked as low-quality — keep, pause, or deprecate
- **Staleness detection**: If a source hasn't published anything in X days, flag it for review
- **Duplicate detection**: Warn if a new source overlaps significantly with an existing one

### Source Dashboard (UI)

- List all sources with status, category, last fetched, and reliability score
- Filter by category, status, or score
- Quick actions: pause, activate, deprecate, edit
- "Add Source" button with URL input and auto-detection of feed type
- Visual indicator for sources that need attention (stale, low-quality)

---

## Source Discovery System

The hardest problem isn't scraping — it's knowing *what* to follow inside noisy platforms like X, LinkedIn, and Reddit. The system needs a discovery layer that helps find the signal within each platform.

### The Problem

- X has millions of accounts — which ones post high-quality AI content?
- LinkedIn is full of engagement bait — how to find genuine researchers and builders?
- Reddit has useful discussions buried under memes and hype — which threads matter?
- New voices emerge constantly — how to discover them before they're mainstream?

### Discovery Workflow (Per Platform)

#### Step 1 — Seed Discovery
Start with a small set of known high-quality accounts/sources per platform:

| Platform | Seed Strategy |
|---|---|
| **X** | Start with known researchers (Karpathy, Yann LeCun, etc.), then discover who they retweet, reply to, and quote |
| **LinkedIn** | Start with AI lab official pages and known researchers, then discover frequent commenters and posters in their threads |
| **Reddit** | Start with core subreddits (r/MachineLearning, r/LocalLLaMA), then identify users whose posts consistently get high upvotes |
| **Hacker News** | Track posts tagged AI/ML that reach front page, identify frequent submitters |
| **GitHub** | Start with trending repos, then track the developers behind them |
| **YouTube** | Start with known channels, then discover through collaborations and recommendations |

#### Step 2 — Candidate Surfacing
The system periodically surfaces **candidate sources** — accounts, subreddits, hashtags, or topics it has detected as potentially relevant. These are NOT automatically added. They go into a **review queue**.

For each candidate, the system shows:
- Who/what it is (account name, subreddit, hashtag)
- Why it was surfaced (e.g., "Retweeted by 3 of your seed accounts", "Posted 5 papers you liked")
- Sample content (3–5 recent posts/articles)
- Platform and content type

#### Step 3 — User Rating Gate
**Nothing gets added without explicit user approval.** For every candidate:

- **Rate 1–5 stars** based on the sample content shown
- **Only sources rated 4+ stars get added** to the active feed
- **3 stars** = watchlist (check again in 2 weeks with fresh samples)
- **1–2 stars** = rejected (don't surface again unless something changes)

This ensures the feed stays high-quality and noise-free.

#### Step 4 — Ongoing Quality Control
Sources that were once rated highly can degrade over time:

- **Continuous re-scoring**: Every source's rating is a rolling average of its initial rating + ongoing thumbs up/down on its content
- **Quality drop alerts**: If a source's rolling score drops below 3 stars, surface a notification: "Source X has been underperforming — keep, pause, or remove?"
- **Periodic re-review**: Every 30 days, show a summary of lowest-performing active sources for batch review

### Platform-Specific Scraping Strategies

| Platform | What to Capture | How |
|---|---|---|
| **X** | Tweets, threads, quoted tweets from followed accounts | **Secondary sources**: ThreadReaderApp RSS, newsletter digests (Last Week in AI, The Batch), curated list RSS exports via Feedbin/Inoreader, Reddit/blog posts ranking top AI Twitter accounts |
| **LinkedIn** | Posts, articles from followed profiles and company pages | **Secondary sources**: Substack/blog authors who cross-post LinkedIn content, newsletter digests, Reddit threads linking LinkedIn posts |
| **Reddit** | Top posts from tracked subreddits, filtered by score threshold | Reddit API (free tier), filter by upvote count and flair |
| **Hacker News** | Front-page AI posts above score threshold | HN Algolia API (free, reliable) |
| **GitHub** | Trending repos, releases from starred repos, new repos by followed devs | GitHub API |
| **YouTube** | New videos from subscribed channels | YouTube Data API |
| **ArXiv** | New papers in tracked categories | ArXiv API (free, structured) |
| **Blogs/Newsletters** | New posts | RSS feeds where available, web scraping as fallback |

### Anti-Noise Filters

Each platform has its own noise patterns. The system should apply platform-specific filters:

| Platform | Noise to Filter Out |
|---|---|
| **X** | Engagement bait, crypto/NFT spam, rage threads, quote-tweet dunks |
| **LinkedIn** | "I'm humbled to announce..." posts, engagement pods, motivational fluff |
| **Reddit** | Memes, low-effort "which model is best" posts, duplicate questions |
| **Hacker News** | Off-topic political tangents, Show HN for unrelated projects |
| **YouTube** | Clickbait titles, sponsor-heavy content with no substance |

Filters can be keyword-based initially, with LLM-based relevance scoring in later phases.

### Secondary Source Discovery (X/LinkedIn Without Paid APIs)

Since X API costs $100/mo and LinkedIn has no public API, we use **secondary aggregator sources** — sites and newsletters that already curate the best content from those platforms:

| Secondary Source Type | Examples | What It Provides |
|---|---|---|
| Thread unrollers | ThreadReaderApp | Popular AI Twitter threads as readable articles |
| Newsletter digests | Last Week in AI, The Batch, Import AI | Weekly curated top AI tweets and LinkedIn posts |
| Curated list RSS exports | Feedbin, Inoreader list exports | RSS feeds from curated X/Twitter lists |
| Reddit/blog rankings | "Best AI Twitter accounts" posts | Lists of high-quality accounts to follow |
| Cross-posting authors | Substack authors who cross-post LinkedIn content | LinkedIn content accessible via RSS |

**How it works:**
1. Secondary aggregator URLs are added to `sources.json` as `type: "rss"` or `type: "scrape"` — the existing RSS/scrape fetchers handle them with zero extra code
2. Articles fetched include the **original X/LinkedIn URL** where possible (extracted from the aggregator content)
3. Discovered accounts/profiles are surfaced in the **Source Discovery Review Queue** for user rating
4. Only accounts rated 4+ stars have their content tracked going forward

This gives X/LinkedIn coverage at **$0/month** cost.

---

## Article Recommendations & URL Linking

Every item displayed on the website must:

- **Show the source URL** — always link back to the original article/post/paper
- **Display a direct "Read" link** — one tap opens the original content
- **Provide a recommendation reason** — why this article is being shown (e.g., "Trending on r/MachineLearning", "From a source you rated highly", "Related to topics you liked")
- **Rank articles by relevance** — using a combination of:
  - Source reliability score
  - User preference history (thumbs up/down)
  - Recency
  - Community engagement (upvotes, stars, citations)
- **Daily/weekly digest view** — "Here are the top 10 things you should read today" with URLs and one-line summaries
- **Save for later** — bookmark articles to read when you have time
- **Mark as read** — track what you've already consumed to avoid showing it again

---

## Core Features

### Personalization & Feedback Loop
- Thumbs up / thumbs down system on individual items
- Preferences stored and used to re-rank future content
- Over time, the feed improves to show more of what I like

### Filtering & Display Controls

The website must offer comprehensive filters so the user can slice the feed however they want. Filters should be combinable (e.g., "show me only research papers from the last 7 days rated 4+ stars").

#### By Content Type
| Filter | What It Shows |
|---|---|
| Research Papers | ArXiv, conference papers, preprints |
| Blog Posts | Long-form articles, tutorials, explainers |
| News | Industry news, product announcements |
| Social Posts | X threads, LinkedIn posts, Reddit discussions |
| Code & Repos | GitHub repos, releases, HuggingFace models |
| Newsletters | Curated digests (The Batch, Import AI, etc.) |
| Videos & Podcasts | YouTube, podcast episodes |
| Benchmarks | Leaderboard updates, eval results |

#### By Source Platform
| Filter | Examples |
|---|---|
| X | Only X/Twitter content |
| LinkedIn | Only LinkedIn posts |
| Reddit | Only Reddit threads |
| GitHub | Only repos and releases |
| ArXiv | Only papers |
| Hacker News | Only HN discussions |
| Blogs | Only blog posts |
| YouTube | Only video content |

#### By Time Range
| Filter | Description |
|---|---|
| Today | Last 24 hours |
| This Week | Last 7 days |
| This Month | Last 30 days |
| Custom Range | Pick start and end date |

#### By Quality / Rating
| Filter | Description |
|---|---|
| Top Rated | Only from sources rated 4–5 stars |
| All Rated | From any rated source (excludes unrated) |
| Unrated | New/unrated sources (for discovery) |

#### By Topic / Domain
| Filter | Examples |
|---|---|
| LLMs | Language models, prompting, fine-tuning |
| Computer Vision | Image generation, object detection, video |
| Reinforcement Learning | RL research, RLHF, agents |
| AI Safety & Alignment | Alignment research, governance, ethics |
| MLOps & Infrastructure | Training infra, serving, deployment |
| Open Source Models | Llama, Mistral, Qwen, local models |
| Multimodal | Vision-language, audio, video models |
| Agents & Tool Use | Autonomous agents, function calling |
| Hardware | GPUs, TPUs, custom chips, benchmarks |
| Startups & Products | New AI products, funding, launches |

#### By Engagement
| Filter | Description |
|---|---|
| Trending | High engagement in the last 24–48 hours |
| Most Liked | Highest thumbs-up from me historically |
| Controversial | High engagement but mixed sentiment |
| Under the Radar | Low engagement but from high-quality sources |

#### By Read Status
| Filter | Description |
|---|---|
| Unread | Not yet opened |
| Read | Already visited |
| Saved for Later | Bookmarked items |

#### Filter UX
- **Filter bar** at the top of the feed — always visible, collapsible on mobile
- **Combine multiple filters** — e.g., "Research Papers" + "This Week" + "Top Rated"
- **Save filter presets** — name and save frequently used filter combos (e.g., "Morning Catch-up", "Deep Research", "Code Watch")
- **Quick toggle chips** — tap to toggle individual filters on/off without opening a panel
- **Clear all** — one button to reset all filters back to default
- **Filter count badge** — show how many results match the current filter combo

### Content Refresh Cadence
- Configurable refresh frequency (daily or every two days)
- Exact schedule to be decided during planning stage

### Naming
- **Decided: AI Pulse**
- Tagline: "Stay on the pulse of AI"

---

## User & Authentication

| Phase | Auth |
|---|---|
| V1 (MVP) | No authentication — single-user, personal use only |
| V2 (Multi-user) | Supabase Auth (email + OAuth), per-user preference storage, personalized feeds via Row Level Security |

---

## Architecture Constraints

### Data Model — What Gets Stored (Supabase / Postgres)

```
Sources:        id, name, url, category, type, status, added_on, last_fetched,
                fetch_frequency, reliability_score, notes, platform
Articles:       id, title, url, source_id, timestamp, summary_snippet,
                content_type, topic_tags, engagement_metrics
Preferences:    id, user_id, article_id, rating (thumbs up/down), created_at
Source Ratings:  id, user_id, source_id, star_rating, created_at
Filter Presets:  id, user_id, name, filter_config (JSONB)
```

### What Does NOT Get Stored
- Full article body / content
- Images or media from articles
- Cached copies of external pages

### API Response Format

All API responses use a consistent envelope:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

---

## Data Ingestion Pipeline (GitHub Actions + Python)

### Pipeline Flow

```
┌─────────┐    ┌───────────┐    ┌─────────────┐    ┌────────┐    ┌───────┐    ┌──────────┐
│  Fetch   │ →  │ Normalize │ →  │ Deduplicate │ →  │  Tag   │ →  │ Score │ →  │  Store   │
│ API/RSS/ │    │ Uniform   │    │ URL + fuzzy │    │ Auto   │    │ Source│    │ Metadata │
│ Scrape   │    │ metadata  │    │ title match │    │ topics │    │ ×time │    │ to Supa- │
│          │    │ format    │    │             │    │        │    │ ×eng. │    │ base     │
└─────────┘    └───────────┘    └─────────────┘    └────────┘    └───────┘    └──────────┘
```

### Ingestion Schedule (GitHub Actions Cron)

| Source Type | Cron Expression | Frequency |
|---|---|---|
| Hacker News, Reddit | `0 */4 * * *` | Every 4 hours |
| GitHub Trending | `0 */6 * * *` | Every 6 hours |
| YouTube | `0 */6 * * *` | Every 6 hours |
| Company blogs | `0 */12 * * *` | Every 12 hours |
| ArXiv, Papers | `0 8 * * *` | Once daily (8 AM UTC) |
| Blogs, Newsletters | `0 9 * * *` | Once daily (9 AM UTC) |

### Ingestion Methods by Source

| Method | Sources | Tool |
|---|---|---|
| **REST API** | Reddit, HN (Algolia), GitHub, ArXiv, YouTube, Semantic Scholar, HuggingFace | Python `requests` / `httpx` |
| **RSS Feeds** | Blogs, newsletters, company blogs, news sites | Python `feedparser` |
| **Web Scraping** | LinkedIn, sites without RSS/API (last resort) | Python `beautifulsoup4` + `httpx` |
| **Manual** | Conferences, one-off finds | Admin UI to paste a URL |

X/Twitter: Skipped (API costs $100/mo). Use curated RSS alternatives or manual curation.

### Ingestion Script Structure

```
ingestion/
├── fetchers/
│   ├── reddit.py          # Reddit API fetcher
│   ├── hackernews.py      # HN Algolia API fetcher
│   ├── github.py          # GitHub API fetcher
│   ├── arxiv.py           # ArXiv API fetcher
│   ├── youtube.py         # YouTube Data API fetcher
│   ├── rss.py             # Generic RSS fetcher (blogs, newsletters)
│   ├── huggingface.py     # HuggingFace API fetcher
│   └── scraper.py         # Generic web scraper (fallback)
├── pipeline/
│   ├── normalizer.py      # Convert all sources to uniform metadata
│   ├── deduplicator.py    # URL + fuzzy title matching
│   ├── tagger.py          # Auto-assign topic tags
│   └── scorer.py          # Initial ranking score
├── config/
│   ├── sources.json       # Source registry (URLs, categories, frequencies)
│   └── settings.py        # Environment variables, Supabase config
├── run.py                 # Main entry point for GitHub Actions
├── requirements.txt       # Python dependencies
└── tests/
    ├── test_fetchers.py
    ├── test_normalizer.py
    ├── test_deduplicator.py
    └── test_scorer.py
```

---

## Development Workflow

### Mandatory Process for Every Feature

```
1. PLAN     → Ask user for preferences → Use planner agent
2. TEST     → Write tests first (RED) → Use tdd-guide agent
3. BUILD    → Implement to pass tests (GREEN) → Follow coding-standards
4. REFACTOR → Clean up (IMPROVE)
5. REVIEW   → Use code-reviewer agent
6. SECURE   → Use security-reviewer agent (if auth/input/API involved)
7. VERIFY   → Run verification-loop (build + types + lint + tests + security)
8. COMMIT   → Conventional commit format
```

### User Preference Checkpoints

**CRITICAL: Ask the user before proceeding at these points:**

- Before starting any new phase → confirm scope and priorities
- Before choosing a tech stack or library → present options with trade-offs
- Before designing UI layout or components → confirm design direction
- Before adding a new data source → confirm it's wanted
- Before any architectural decision → present alternatives
- Before deploying anything → confirm readiness
- When multiple valid approaches exist → present options, let user decide

Never assume. When in doubt, ask.

### Development Philosophy

- **Plan before build** — never implement without a written plan
- **Versioned planning** — create a project roadmap document; plan in versions
- **Staged rollout** — development environment first, production later
- **Iterative improvement** — feedback loop built in from day one
- **Phased with sub-phases** — no big-bang builds; each phase is broken into small, deliverable sub-phases
- **TDD mandatory** — write tests first, then implement (RED → GREEN → REFACTOR)
- **80%+ test coverage** — non-negotiable for every phase
- **Immutability** — never mutate data; always create new objects

---

## Development Phases (Detailed)

### Phase 0 — Research & Planning
> No code written. Only plans and decisions.

| Sub-Phase | What | Agent/Skill to Use |
|---|---|---|
| 0.1 | Research existing news aggregators and competitors | `deep-research` skill |
| 0.2 | Evaluate data sources (APIs vs scraping) | `deep-research` skill |
| 0.3 | ~~Define tech stack~~ **DECIDED**: Next.js + Tailwind + Supabase + Upstash + GitHub Actions + Python | `architect` agent |
| 0.4 | System architecture and data flow design | `architect` agent |
| 0.5 | Create detailed project roadmap with task breakdown | `planner` agent |
| 0.6 | Generate planning docs: PRD, architecture, tech doc | `planner` agent |

---

### Phase 1 — Foundation (Backend Core)
> Get the server and data layer working.

| Sub-Phase | What | Agent/Skill to Use |
|---|---|---|
| 1.1 | Project setup: Next.js + TypeScript + Tailwind CSS + Vitest | `coding-standards` skill |
| 1.2 | Supabase setup: database schema (sources, article metadata, preferences) | `database-reviewer` agent, `postgres-patterns` skill |
| 1.3 | Repository layer with Supabase client | `backend-patterns` skill, `tdd-guide` agent |
| 1.4 | Core API routes: `/articles`, `/sources` with cursor-based pagination | `api-design` skill, `tdd-guide` agent |
| 1.5 | Input validation (Zod schemas) and error handling | `security-review` skill |
| 1.6 | Python ingestion scripts + GitHub Actions cron workflows | `python-patterns` skill, `tdd-guide` agent |
| 1.7 | Code review of entire Phase 1 | `code-reviewer` agent |
| 1.8 | UI wireframes & mockups (rough clickable HTML + Tailwind, no backend) — **USER APPROVAL REQUIRED** before Phase 2 | `frontend-patterns` skill |

---

### Phase 2 — Frontend (Mobile-First UI)
> Build the interface, mobile-first with Tailwind CSS.

| Sub-Phase | What | Agent/Skill to Use |
|---|---|---|
| 2.1 | Tailwind config: design tokens (colors, typography, spacing, dark mode) | `frontend-patterns` skill |
| 2.2 | Responsive layout shell (Tailwind mobile-first: `sm:`, `md:`, `lg:`) | `frontend-patterns` skill |
| 2.3 | Article card component (with virtualized list for perf) | `frontend-patterns` skill, `tdd-guide` agent |
| 2.4 | Search with debouncing | `frontend-patterns` skill |
| 2.5 | Filter and category panels | `frontend-patterns` skill |
| 2.6 | Article detail view | `frontend-patterns` skill |
| 2.7 | State management (React Query / SWR for caching) | `frontend-patterns` skill |
| 2.8 | E2E tests for critical user flows | `e2e-runner` agent, `e2e-testing` skill |
| 2.9 | Code review of entire Phase 2 | `code-reviewer` agent |

---

### Phase 3 — Personalization & Feedback
> Make the feed smart.

| Sub-Phase | What | Agent/Skill to Use |
|---|---|---|
| 3.1 | Thumbs up / thumbs down UI component | `frontend-patterns` skill, `tdd-guide` agent |
| 3.2 | Preference storage (database schema for feedback) | `backend-patterns` skill |
| 3.3 | Re-ranking algorithm based on user feedback | `backend-patterns` skill, `tdd-guide` agent |
| 3.4 | Semantic search with vector embeddings (optional) | `backend-patterns` skill |
| 3.5 | Code review and security audit | `code-reviewer` agent, `security-reviewer` agent |

---

### Phase 4 — Multi-User & Authentication
> Open it up to other users.

| Sub-Phase | What | Agent/Skill to Use |
|---|---|---|
| 4.1 | Supabase Auth (email + OAuth providers) | `backend-patterns` skill, `security-review` skill |
| 4.2 | Per-user preference storage with Row Level Security (RLS) | `backend-patterns` skill |
| 4.3 | Personalized feeds per user | `backend-patterns` skill, `tdd-guide` agent |
| 4.4 | User profile and settings page | `frontend-patterns` skill |
| 4.5 | Full security audit | `security-reviewer` agent |

---

### Phase 5 — Production & Deployment
> Ship it.

| Sub-Phase | What | Agent/Skill to Use |
|---|---|---|
| 5.1 | Environment configuration (Vercel env vars, GitHub Secrets) | `security-review` skill |
| 5.2 | GitHub Actions CI/CD pipeline (lint + test + deploy to Vercel) | `deployment-patterns` skill |
| 5.3 | Performance optimization (Upstash Redis caching, lazy loading, Vercel CDN) | `frontend-patterns` skill, `backend-patterns` skill |
| 5.4 | Monitoring and error tracking (Sentry, structured logging) | `backend-patterns` skill |
| 5.5 | Final verification loop | `verification-loop` skill |
| 5.6 | Deploy to Vercel production | `deployment-patterns` skill |

---

## Code Standards

### Immutability (CRITICAL)
Never mutate existing objects. Always create new copies with changes.

### Styling (Tailwind CSS)
- Use Tailwind utility classes exclusively — no custom CSS unless absolutely necessary
- Mobile-first responsive: start with base styles, layer `sm:`, `md:`, `lg:` breakpoints
- Use Tailwind config (`tailwind.config.ts`) for design tokens (colors, spacing, fonts)
- Component variants via `clsx` or `cva` (class-variance-authority) — not inline conditionals
- Dark mode support via `dark:` prefix (class-based strategy)
- No `@apply` in global CSS except for truly global resets
- Prefer Tailwind's built-in animations (`animate-pulse`, `animate-spin`) over custom keyframes

### File Organization
- Many small files (200–400 lines, 800 max)
- Organize by feature/domain, not by type
- Functions under 50 lines
- No nesting deeper than 4 levels

### Error Handling
- Handle errors explicitly at every level
- User-friendly messages in UI, detailed logs on server
- Never silently swallow errors

### Input Validation
- Validate all user input with Zod schemas
- Validate all external API responses before processing
- Fail fast with clear error messages

### Testing
- 80%+ coverage (non-negotiable)
- Unit tests: individual functions, components
- Integration tests: API endpoints, database operations
- E2E tests: critical user flows (Playwright)
- TDD: write tests first, always

### Security
- No hardcoded secrets — use environment variables
- Parameterized queries (no raw SQL)
- Sanitize any external content before rendering
- Rate limiting on all endpoints
- CSRF protection, httpOnly cookies
- API keys for external services stored in env only

---

## Skills & Agents Reference

### Planning & Architecture
| Skill / Agent | When | Invocation |
|---|---|---|
| `planner` agent | Before starting any phase or complex feature | Launch planner agent |
| `architect` agent | System design, tech stack, data flow decisions | Launch architect agent |
| `everything-claude-code:plan` | Structured implementation planning | `/plan` |
| `everything-claude-code:search-first` | Before writing any new code — find existing solutions | `/search-first` |

### Frontend Development
| Skill / Agent | When | Invocation |
|---|---|---|
| `everything-claude-code:frontend-patterns` | React/Next.js components, state, responsive design | `/frontend-patterns` |
| `everything-claude-code:coding-standards` | Naming, immutability, TypeScript best practices | `/coding-standards` |

### Backend Development
| Skill / Agent | When | Invocation |
|---|---|---|
| `everything-claude-code:backend-patterns` | API routes, repository pattern, caching, background jobs | `/backend-patterns` |
| `everything-claude-code:api-design` | REST conventions, pagination, response format | `/api-design` |
| `everything-claude-code:postgres-patterns` | Schema design, indexing, query optimization | `/postgres-patterns` |
| `everything-claude-code:database-migrations` | Schema changes, data migrations, rollbacks | `/database-migrations` |
| `database-reviewer` agent | Review schema and query performance | Launch database-reviewer agent |

### Testing
| Skill / Agent | When | Invocation |
|---|---|---|
| `tdd-guide` agent | Every feature — enforces write-tests-first | Launch tdd-guide agent |
| `everything-claude-code:tdd-workflow` | RED → GREEN → REFACTOR methodology | `/tdd-workflow` |
| `everything-claude-code:tdd` | Scaffold interfaces, generate tests first | `/tdd` |
| `e2e-runner` agent | Critical user flows end-to-end | Launch e2e-runner agent |
| `everything-claude-code:e2e-testing` | Playwright patterns, POM, CI integration | `/e2e-testing` |
| `everything-claude-code:e2e` | Generate and run E2E tests | `/e2e` |

### Code Quality & Review
| Skill / Agent | When | Invocation |
|---|---|---|
| `code-reviewer` agent | After writing code, before committing | Launch code-reviewer agent |
| `everything-claude-code:simplify` | Review changed code for reuse and efficiency | `/simplify` |
| `refactor-cleaner` agent | Dead code cleanup, consolidation | Launch refactor-cleaner agent |
| `everything-claude-code:verification-loop` | 6-phase quality gate before shipping | `/verification-loop` |

### Security
| Skill / Agent | When | Invocation |
|---|---|---|
| `security-reviewer` agent | Before deployment, after auth/input changes | Launch security-reviewer agent |
| `everything-claude-code:security-review` | OWASP checklist, input validation, secrets | `/security-review` |
| `everything-claude-code:security-scan` | Scan config for vulnerabilities | `/security-scan` |

### Research & Discovery
| Skill / Agent | When | Invocation |
|---|---|---|
| `everything-claude-code:deep-research` | Evaluate technologies, competitors, APIs | `/deep-research` |
| `everything-claude-code:exa-search` | Web search for code, companies, research | `/exa-search` |

### Deployment & Operations
| Skill / Agent | When | Invocation |
|---|---|---|
| `everything-claude-code:deployment-patterns` | CI/CD, Docker, health checks, monitoring | `/deployment-patterns` |
| `build-error-resolver` agent | When build fails | Launch build-error-resolver agent |
| `doc-updater` agent | Keep documentation in sync with code | Launch doc-updater agent |

### Python (Data Ingestion)
| Skill / Agent | When | Invocation |
|---|---|---|
| `everything-claude-code:python-patterns` | Pythonic idioms, type hints, ingestion scripts | `/python-patterns` |
| `everything-claude-code:python-review` | Review Python ingestion code | `/python-review` |
| `everything-claude-code:python-testing` | pytest for ingestion pipeline tests | `/python-testing` |

---

## Parallel Agent Strategy

For independent tasks within a phase, always run agents in parallel:

```
Example — Phase 1.2 (Database Schema):
  Agent 1: database-reviewer → schema design review
  Agent 2: security-reviewer → check for data exposure risks
  Agent 3: tdd-guide → generate schema migration tests

Example — Phase 2 (Frontend):
  Agent 1: frontend component development
  Agent 2: e2e-runner → test critical flows
  Agent 3: code-reviewer → review completed components
```

Never run agents sequentially when they can run in parallel.

---

## Git Conventions

### Commit Message Format
```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Branch Strategy
- `main` — stable, deployable
- `dev` — integration branch
- `feature/<phase>-<sub-phase>-<name>` — e.g., `feature/1.2-database-schema`

---

## Key Decisions Log

| Date | Decision | Rationale | Phase |
|---|---|---|---|
| 2026-03-14 | Tech stack: Next.js + Tailwind + Supabase + Upstash Redis | All free tier, TypeScript end-to-end for web, best DX | Phase 0 |
| 2026-03-14 | Data ingestion: Python scripts on GitHub Actions cron | Free, Python has best scraping/RSS libs, no extra platform | Phase 0 |
| 2026-03-14 | Hosting: Vercel (frontend) + GitHub Actions (workers) | Both free, no paid services needed | Phase 0 |
| 2026-03-14 | Skip X API (costs $100/mo) | Free tier constraint; use RSS alternatives or manual curation | Phase 0 |
| 2026-03-14 | Styling: Tailwind CSS (mobile-first utility classes) | Fast development, responsive out of the box, small bundle | Phase 0 |
| 2026-03-15 | Website name: **AI Pulse** | Short, memorable, communicates "stay current with AI" | Phase 0 |
| 2026-03-15 | Secondary source discovery for X/LinkedIn | Use aggregator sites (ThreadReaderApp, newsletter digests, curated list RSS) instead of paid APIs — $0 cost | Phase 0 |
| 2026-03-15 | UI wireframes step added to Phase 1 (sub-phase 1.8) | User can review rough design before Phase 2 coding begins | Phase 0 |

---

## Remaining Open Questions
- PWA vs native web app?
- How to store and apply user preferences (ranking model, simple filters, embedding similarity?)
