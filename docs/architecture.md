# Architecture Document -- LLM News Aggregator

> **Last updated:** 2026-03-15
> **Status:** Phase 0 (Research & Planning)

---

## 1. System Overview

### Two-Service Architecture

The system is split across two free-tier platforms with a shared database and cache layer.

```
                          USER (Mobile / Desktop Browser)
                                      |
                                      v
                    ┌─────────────────────────────────────┐
                    │          Vercel (Free Tier)          │
                    │                                     │
                    │   Next.js App Router (SSR + CSR)    │
                    │   ├── Pages (React, Tailwind CSS)   │
                    │   └── API Routes (/api/*)           │
                    │               |                     │
                    │               v                     │
                    │   ┌───────────────────────┐         │
                    │   │   Upstash Redis        │         │
                    │   │   (Cache Layer)         │         │
                    │   └───────────┬───────────┘         │
                    │               |                     │
                    └───────────────┼─────────────────────┘
                                    |
                                    v
                    ┌───────────────────────────────┐
                    │   Supabase (Postgres, Free)   │
                    │   ├── sources                 │
                    │   ├── articles                │
                    │   ├── article_preferences     │
                    │   ├── source_ratings          │
                    │   └── filter_presets          │
                    └───────────────┬───────────────┘
                                    ^
                                    |
                    ┌───────────────┼─────────────────────┐
                    │   GitHub Actions (Free Tier)         │
                    │                                     │
                    │   Python Ingestion Workers           │
                    │   ├── API fetchers (HN, Reddit,     │
                    │   │   GitHub, ArXiv, YouTube, etc.)  │
                    │   ├── RSS fetchers (blogs,           │
                    │   │   newsletters, company blogs)    │
                    │   ├── Normalizer                     │
                    │   ├── Deduplicator                   │
                    │   ├── Tagger (auto topic tags)       │
                    │   └── Scorer (initial ranking)       │
                    │               |                     │
                    │               v                     │
                    │   Upstash Redis (dedup cache)       │
                    └─────────────────────────────────────┘
```

### Data Flow

```
Sources (APIs, RSS, Scrape)
        |
        v
  [1] FETCH ─── Python fetcher scripts pull metadata from external APIs/RSS
        |
        v
  [2] NORMALIZE ─── Convert heterogeneous formats to uniform article metadata
        |
        v
  [3] DEDUPLICATE ─── URL exact match + fuzzy title match (Redis dedup cache)
        |
        v
  [4] TAG ─── Auto-assign topic tags based on keywords, categories, subreddit
        |
        v
  [5] SCORE ─── Compute initial ranking: source_reliability * recency * engagement
        |
        v
  [6] STORE ─── Insert article metadata into Supabase Postgres
        |
        v
  [7] API ─── Next.js API routes read from Supabase, cache via Upstash Redis
        |
        v
  [8] FRONTEND ─── React components render feed, filters, search, digest
        |
        v
  [9] USER ─── Clicks "Read" link, opens original article at source URL
```

---

## 2. Database Schema (Supabase / Postgres)

### Table Definitions

```sql
-- =============================================================================
-- SOURCES
-- =============================================================================
CREATE TABLE sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL CHECK (category IN (
                        'research', 'social', 'code', 'news', 'company',
                        'conference', 'people', 'benchmark', 'podcast'
                    )),
    type            TEXT NOT NULL CHECK (type IN ('rss', 'api', 'scrape', 'manual')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deprecated')),
    platform        TEXT NOT NULL CHECK (platform IN (
                        'arxiv', 'reddit', 'hackernews', 'github', 'huggingface',
                        'youtube', 'x', 'linkedin', 'lobsters', 'discord',
                        'blog', 'newsletter', 'pypi', 'semantic_scholar',
                        'papers_with_code', 'openreview', 'ollama', 'other'
                    )),
    added_on        DATE NOT NULL DEFAULT CURRENT_DATE,
    last_fetched    TIMESTAMPTZ,
    fetch_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (fetch_frequency IN (
                        'hourly', 'every_4h', 'every_6h', 'every_12h', 'daily', 'weekly'
                    )),
    reliability_score NUMERIC(3, 2) DEFAULT 3.00 CHECK (
                        reliability_score >= 0 AND reliability_score <= 5
                    ),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- ARTICLES
-- =============================================================================
CREATE TABLE articles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   TEXT NOT NULL,
    url                     TEXT NOT NULL UNIQUE,
    source_id               UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    published_at            TIMESTAMPTZ,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    summary_snippet         TEXT,
    content_type            TEXT NOT NULL CHECK (content_type IN (
                                'paper', 'blog', 'news', 'social', 'code',
                                'newsletter', 'video', 'podcast', 'benchmark'
                            )),
    topic_tags              TEXT[] DEFAULT '{}',
    platform                TEXT NOT NULL CHECK (platform IN (
                                'arxiv', 'reddit', 'hackernews', 'github', 'huggingface',
                                'youtube', 'x', 'linkedin', 'lobsters', 'discord',
                                'blog', 'newsletter', 'pypi', 'semantic_scholar',
                                'papers_with_code', 'openreview', 'ollama', 'other'
                            )),
    engagement_score        NUMERIC(10, 2) DEFAULT 0,
    engagement_metrics      JSONB DEFAULT '{}',
    recommendation_reason   TEXT,
    is_read                 BOOLEAN NOT NULL DEFAULT false,
    is_saved                BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- ARTICLE PREFERENCES (thumbs up / thumbs down)
-- =============================================================================
CREATE TABLE article_preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    rating      TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (article_id)
);

-- =============================================================================
-- SOURCE RATINGS (1-5 stars)
-- =============================================================================
CREATE TABLE source_ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    star_rating INTEGER NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_id)
);

-- =============================================================================
-- FILTER PRESETS
-- =============================================================================
CREATE TABLE filter_presets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    filter_config   JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes

```sql
-- articles indexes
CREATE INDEX idx_articles_source_id     ON articles (source_id);
CREATE INDEX idx_articles_published_at  ON articles (published_at DESC);
CREATE INDEX idx_articles_content_type  ON articles (content_type);
CREATE INDEX idx_articles_platform      ON articles (platform);
CREATE INDEX idx_articles_is_read       ON articles (is_read);
CREATE INDEX idx_articles_is_saved      ON articles (is_saved);
CREATE INDEX idx_articles_topic_tags    ON articles USING GIN (topic_tags);

-- sources indexes
CREATE INDEX idx_sources_status         ON sources (status);
CREATE INDEX idx_sources_category       ON sources (category);
```

### Auto-Update Trigger for `sources.updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Seed Data -- Initial Sources (60+)

```sql
-- =============================================================================
-- RESEARCH & PAPERS
-- =============================================================================
INSERT INTO sources (name, url, category, type, status, platform, fetch_frequency, reliability_score, notes) VALUES
('ArXiv -- cs.AI',           'https://arxiv.org/list/cs.AI',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'AI section of ArXiv'),
('ArXiv -- cs.LG',           'https://arxiv.org/list/cs.LG',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'Machine Learning section'),
('ArXiv -- cs.CL',           'https://arxiv.org/list/cs.CL',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'Computation and Language (NLP)'),
('ArXiv -- cs.CV',           'https://arxiv.org/list/cs.CV',             'research', 'api',   'active', 'arxiv',             'daily',     4.50, 'Computer Vision section'),
('Semantic Scholar',          'https://semanticscholar.org',              'research', 'api',   'active', 'semantic_scholar',  'daily',     4.00, 'Paper search and citation tracking with TLDRs'),
('Papers With Code',          'https://paperswithcode.com',               'research', 'api',   'active', 'papers_with_code',  'daily',     4.50, 'Papers linked to code repos and benchmarks'),
('OpenReview',                'https://openreview.net',                   'research', 'api',   'active', 'openreview',        'weekly',    4.00, 'Conference submissions and reviews'),
('Hugging Face Papers',       'https://huggingface.co/papers',            'research', 'api',   'active', 'huggingface',       'daily',     4.50, 'Daily curated ML papers'),

-- =============================================================================
-- SOCIAL & COMMUNITY
-- =============================================================================
('Reddit -- r/MachineLearning', 'https://reddit.com/r/MachineLearning',  'social',   'api',   'active', 'reddit',            'every_4h',  4.50, 'Premier ML community on Reddit'),
('Reddit -- r/LocalLLaMA',      'https://reddit.com/r/LocalLLaMA',       'social',   'api',   'active', 'reddit',            'every_4h',  4.00, 'Local and open-source LLM discussion'),
('Reddit -- r/artificial',      'https://reddit.com/r/artificial',        'social',   'api',   'active', 'reddit',            'every_4h',  3.50, 'General AI discussion'),
('Reddit -- r/singularity',     'https://reddit.com/r/singularity',       'social',   'api',   'active', 'reddit',            'every_4h',  3.00, 'Future of AI / AGI speculation'),
('Hacker News',                 'https://news.ycombinator.com',           'social',   'api',   'active', 'hackernews',        'every_4h',  4.50, 'AI-tagged posts via Algolia API'),
('Lobsters',                    'https://lobste.rs',                      'social',   'api',   'active', 'lobsters',          'every_6h',  4.00, 'Curated tech community, ai/ml tags'),

-- =============================================================================
-- CODE & OPEN SOURCE
-- =============================================================================
('GitHub Trending',               'https://github.com/trending',            'code', 'api',   'active', 'github',     'every_6h',  4.00, 'Trending ML/AI repos'),
('GitHub Releases (tracked)',     'https://github.com',                     'code', 'api',   'active', 'github',     'every_6h',  4.00, 'Release pages of tracked repos'),
('Hugging Face Models',           'https://huggingface.co/models',          'code', 'api',   'active', 'huggingface','daily',     4.50, 'New model uploads'),
('Hugging Face Spaces',           'https://huggingface.co/spaces',          'code', 'api',   'active', 'huggingface','daily',     4.00, 'Interactive demos'),
('PyPI -- AI Packages',           'https://pypi.org',                       'code', 'rss',   'active', 'pypi',       'daily',     3.50, 'New AI-related Python packages'),
('Ollama Library',                'https://ollama.com/library',             'code', 'scrape','active', 'ollama',     'daily',     4.00, 'Local model releases'),

-- =============================================================================
-- NEWS & BLOGS
-- =============================================================================
('The Batch (Andrew Ng)',         'https://www.deeplearning.ai/the-batch/',       'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'Weekly AI newsletter by Andrew Ng'),
('Import AI (Jack Clark)',        'https://importai.substack.com',                'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'Weekly AI research roundup'),
('The Gradient',                  'https://thegradient.pub',                      'news', 'rss', 'active', 'blog',       'daily',     4.00, 'Long-form AI analysis'),
('Ahead of AI (Sebastian Raschka)', 'https://magazine.sebastianraschka.com',      'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'Deep dives into LLM research'),
('Simon Willison''s Blog',        'https://simonwillison.net',                    'news', 'rss', 'active', 'blog',       'daily',     4.50, 'LLMs, AI tools, open source'),
('Lil''Log (Lilian Weng)',        'https://lilianweng.github.io',                 'news', 'rss', 'active', 'blog',       'weekly',    5.00, 'Deep technical posts on ML/AI'),
('Jay Alammar',                   'https://jalammar.github.io',                   'news', 'rss', 'active', 'blog',       'weekly',    4.50, 'Visual explainers for ML concepts'),
('Chip Huyen''s Blog',            'https://huyenchip.com',                        'news', 'rss', 'active', 'blog',       'weekly',    4.50, 'MLOps, LLMs, AI engineering'),
('MIT Technology Review -- AI',   'https://www.technologyreview.com/ai',          'news', 'rss', 'active', 'blog',       'every_12h', 4.00, 'Mainstream AI news coverage'),
('VentureBeat AI',                'https://venturebeat.com/ai',                   'news', 'rss', 'active', 'blog',       'every_12h', 3.50, 'AI industry news'),
('The Verge -- AI',               'https://www.theverge.com/ai-artificial-intelligence', 'news', 'rss', 'active', 'blog', 'every_12h', 3.50, 'Consumer AI news'),
('Ars Technica -- AI',            'https://arstechnica.com/ai',                   'news', 'rss', 'active', 'blog',       'every_12h', 4.00, 'Technical AI journalism'),
('TechCrunch -- AI',              'https://techcrunch.com/category/artificial-intelligence', 'news', 'rss', 'active', 'blog', 'every_12h', 3.50, 'AI startup and product news'),
('Latent Space Podcast',          'https://www.latent.space',                     'news', 'rss', 'active', 'newsletter', 'daily',     4.50, 'AI engineering podcast and newsletter'),

-- =============================================================================
-- COMPANIES & LABS
-- =============================================================================
('OpenAI Blog',                 'https://openai.com/news',                        'company', 'rss',   'active', 'blog',   'every_12h', 5.00, 'Official OpenAI announcements'),
('Anthropic Research',          'https://anthropic.com/research',                  'company', 'scrape','active', 'blog',   'every_12h', 5.00, 'Anthropic papers and updates'),
('Google DeepMind Blog',        'https://deepmind.google/discover/blog',           'company', 'scrape','active', 'blog',   'every_12h', 5.00, 'DeepMind research'),
('Meta AI Blog',                'https://ai.meta.com/blog',                        'company', 'scrape','active', 'blog',   'every_12h', 5.00, 'Meta AI research and releases'),
('Microsoft Research Blog',     'https://www.microsoft.com/en-us/research/blog',   'company', 'rss',   'active', 'blog',   'every_12h', 4.50, 'MS Research blog with RSS'),
('Mistral AI Blog',             'https://mistral.ai/news',                         'company', 'scrape','active', 'blog',   'every_12h', 4.50, 'Mistral announcements'),
('Cohere Blog',                 'https://cohere.com/blog',                         'company', 'scrape','active', 'blog',   'every_12h', 4.00, 'Cohere product and research'),
('Stability AI',                'https://stability.ai/news',                       'company', 'scrape','active', 'blog',   'every_12h', 4.00, 'Stability AI announcements'),
('NVIDIA AI Blog',              'https://blogs.nvidia.com/blog/category/deep-learning', 'company', 'rss', 'active', 'blog', 'every_12h', 4.50, 'Hardware, models, deep learning'),
('Apple Machine Learning',      'https://machinelearning.apple.com',               'company', 'rss',   'active', 'blog',   'weekly',    4.50, 'Apple ML research journal'),
('xAI',                         'https://x.ai',                                    'company', 'scrape','active', 'blog',   'weekly',    4.00, 'xAI announcements'),

-- =============================================================================
-- CONFERENCES & EVENTS
-- =============================================================================
('NeurIPS',           'https://neurips.cc',          'conference', 'scrape', 'active', 'other', 'weekly', 5.00, 'Top ML conference'),
('ICML',              'https://icml.cc',             'conference', 'scrape', 'active', 'other', 'weekly', 5.00, 'International Conference on ML'),
('ICLR',              'https://iclr.cc',             'conference', 'scrape', 'active', 'other', 'weekly', 5.00, 'International Conference on Learning Representations'),
('AAAI',              'https://aaai.org',            'conference', 'scrape', 'active', 'other', 'weekly', 4.50, 'Association for AI conference'),
('CVPR',              'https://cvpr.thecvf.com',     'conference', 'scrape', 'active', 'other', 'weekly', 4.50, 'Computer Vision conference'),
('ACL',               'https://aclweb.org',          'conference', 'scrape', 'active', 'other', 'weekly', 4.50, 'NLP conference'),
('EMNLP',             'https://emnlp.org',           'conference', 'scrape', 'active', 'other', 'weekly', 4.00, 'Empirical Methods in NLP'),
('AI Engineer Summit', 'https://ai.engineer',        'conference', 'scrape', 'active', 'other', 'weekly', 4.00, 'Applied AI engineering conference'),

-- =============================================================================
-- BENCHMARKS & LEADERBOARDS
-- =============================================================================
('LMSYS Chatbot Arena',        'https://lmarena.ai',                                       'benchmark', 'scrape', 'active', 'other',       'daily',     5.00, 'Community LLM rankings via blind voting'),
('Open LLM Leaderboard',       'https://huggingface.co/spaces/open-llm-leaderboard',       'benchmark', 'api',    'active', 'huggingface', 'daily',     4.50, 'HuggingFace-hosted benchmark leaderboard'),
('Artificial Analysis',        'https://artificialanalysis.ai',                             'benchmark', 'scrape', 'active', 'other',       'daily',     4.50, 'LLM price/performance comparisons'),

-- =============================================================================
-- PODCASTS & VIDEO
-- =============================================================================
('Lex Fridman Podcast',               'https://lexfridman.com/podcast',                        'podcast', 'rss',   'active', 'youtube',  'every_6h', 4.50, 'Long-form AI researcher interviews'),
('Machine Learning Street Talk',      'https://www.youtube.com/@MachineLearningStreetTalk',    'podcast', 'api',   'active', 'youtube',  'every_6h', 4.50, 'Technical ML discussions'),
('Yannic Kilcher',                    'https://www.youtube.com/@YannicKilcher',                'podcast', 'api',   'active', 'youtube',  'every_6h', 4.50, 'Paper reviews and ML commentary'),
('Two Minute Papers',                 'https://www.youtube.com/@TwoMinutePapers',              'podcast', 'api',   'active', 'youtube',  'every_6h', 4.00, 'Short AI paper summaries'),
('No Priors Podcast',                 'https://www.youtube.com/@NoPriorsPodcast',              'podcast', 'api',   'active', 'youtube',  'every_6h', 4.00, 'AI industry interviews');
```

---

## 3. API Route Structure

All responses use the standard envelope:

```typescript
interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    error: string | null;
    meta?: {
        total: number;
        cursor?: string;
        has_more: boolean;
    };
}
```

### Articles

#### `GET /api/articles`

List articles with filtering and cursor-based pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `content_type` | string | all | Filter: `paper`, `blog`, `news`, `social`, `code`, `newsletter`, `video`, `podcast`, `benchmark` |
| `platform` | string | all | Filter: `arxiv`, `reddit`, `hackernews`, `github`, `huggingface`, `youtube`, `blog`, etc. |
| `time_range` | string | `all` | `today`, `week`, `month`, `all`, or ISO date range `2026-03-01,2026-03-15` |
| `quality` | string | `all` | `top_rated` (source 4-5 stars), `all_rated`, `unrated` |
| `topic` | string | all | Topic tag filter (e.g., `llms`, `computer_vision`, `agents`) |
| `engagement` | string | `all` | `trending`, `most_liked`, `controversial`, `under_the_radar` |
| `read_status` | string | `all` | `unread`, `read`, `saved` |
| `cursor` | string | null | Opaque cursor for next page |
| `limit` | number | 20 | Items per page (max 50) |

**Response:**

```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "Scaling Laws for Neural Language Models",
            "url": "https://arxiv.org/abs/...",
            "source": { "id": "uuid", "name": "ArXiv -- cs.CL", "reliability_score": 4.5 },
            "published_at": "2026-03-14T08:00:00Z",
            "fetched_at": "2026-03-14T09:00:00Z",
            "summary_snippet": "We study empirical scaling laws for...",
            "content_type": "paper",
            "topic_tags": ["llms", "scaling"],
            "platform": "arxiv",
            "engagement_score": 85.5,
            "engagement_metrics": { "citations": 12 },
            "recommendation_reason": "Trending on ArXiv, from a 4.5-star source",
            "is_read": false,
            "is_saved": false,
            "created_at": "2026-03-14T09:00:00Z"
        }
    ],
    "error": null,
    "meta": { "total": 342, "cursor": "eyJpZCI6Ii4uLiJ9", "has_more": true }
}
```

---

#### `GET /api/articles/[id]`

Get a single article by ID.

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "title": "...", "url": "...", "..." : "..." },
    "error": null
}
```

---

#### `GET /api/articles/search?q=`

Full-text search across article titles and summary snippets.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | required | Search query |
| `cursor` | string | null | Pagination cursor |
| `limit` | number | 20 | Items per page (max 50) |

**Response:** Same shape as `GET /api/articles`.

---

#### `POST /api/articles/[id]/read`

Mark an article as read.

**Request Body:** None (toggle or set).

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "is_read": true },
    "error": null
}
```

---

#### `POST /api/articles/[id]/save`

Toggle bookmark / save-for-later.

**Request Body:** None.

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "is_saved": true },
    "error": null
}
```

---

#### `POST /api/articles/[id]/rate`

Rate an article (thumbs up / thumbs down).

**Request Body:**

```json
{ "rating": "up" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rating` | `"up"` or `"down"` | yes | Article preference |

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "article_id": "uuid", "rating": "up" },
    "error": null
}
```

---

### Sources

#### `GET /api/sources`

List all sources with optional filters.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | all | Filter by category |
| `status` | string | all | `active`, `paused`, `deprecated` |
| `platform` | string | all | Filter by platform |

**Response:**

```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "name": "ArXiv -- cs.AI",
            "url": "https://arxiv.org/list/cs.AI",
            "category": "research",
            "type": "api",
            "status": "active",
            "platform": "arxiv",
            "added_on": "2026-03-15",
            "last_fetched": "2026-03-15T08:00:00Z",
            "fetch_frequency": "daily",
            "reliability_score": 4.50,
            "notes": "AI section of ArXiv",
            "created_at": "2026-03-15T00:00:00Z",
            "updated_at": "2026-03-15T08:00:00Z"
        }
    ],
    "error": null,
    "meta": { "total": 62, "has_more": false }
}
```

---

#### `POST /api/sources`

Add a new source.

**Request Body:**

```json
{
    "name": "New AI Blog",
    "url": "https://example.com/blog",
    "category": "news",
    "type": "rss",
    "platform": "blog",
    "fetch_frequency": "daily",
    "notes": "Discovered via recommendation"
}
```

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "name": "New AI Blog", "..." : "..." },
    "error": null
}
```

---

#### `PATCH /api/sources/[id]`

Update source fields (name, url, category, type, fetch_frequency, notes).

**Request Body:** Partial object with only fields to update.

```json
{ "fetch_frequency": "every_12h", "notes": "Updated notes" }
```

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "..." : "..." },
    "error": null
}
```

---

#### `PATCH /api/sources/[id]/status`

Change source status (active, paused, deprecated).

**Request Body:**

```json
{ "status": "paused" }
```

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "status": "paused" },
    "error": null
}
```

---

#### `GET /api/sources/[id]/rate`

Get the current star rating for a source.

**Response:**

```json
{
    "success": true,
    "data": { "source_id": "uuid", "star_rating": 4 },
    "error": null
}
```

Returns `"data": null` if no rating exists yet.

---

#### `POST /api/sources/[id]/rate`

Set or update the star rating for a source.

**Request Body:**

```json
{ "star_rating": 5 }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `star_rating` | integer (1-5) | yes | Quality rating |

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "source_id": "uuid", "star_rating": 5 },
    "error": null
}
```

---

### Filter Presets

#### `GET /api/filter-presets`

List all saved filter presets.

**Response:**

```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "name": "Morning Catch-up",
            "filter_config": {
                "time_range": "today",
                "quality": "top_rated",
                "content_type": ["paper", "blog", "news"]
            },
            "created_at": "2026-03-15T00:00:00Z"
        }
    ],
    "error": null,
    "meta": { "total": 3, "has_more": false }
}
```

---

#### `POST /api/filter-presets`

Create a new filter preset.

**Request Body:**

```json
{
    "name": "Deep Research",
    "filter_config": {
        "content_type": ["paper"],
        "quality": "top_rated",
        "topic": "llms"
    }
}
```

**Response:**

```json
{
    "success": true,
    "data": { "id": "uuid", "name": "Deep Research", "..." : "..." },
    "error": null
}
```

---

#### `DELETE /api/filter-presets/[id]`

Delete a filter preset.

**Response:**

```json
{
    "success": true,
    "data": { "deleted": true },
    "error": null
}
```

---

### Digest

#### `GET /api/digest`

Get the daily/weekly digest of top articles.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `daily` | `daily` or `weekly` |
| `limit` | number | 10 | Number of top items |

**Response:**

```json
{
    "success": true,
    "data": {
        "period": "daily",
        "date": "2026-03-15",
        "articles": [
            { "id": "uuid", "title": "...", "url": "...", "summary_snippet": "...", "recommendation_reason": "..." }
        ]
    },
    "error": null,
    "meta": { "total": 10, "has_more": false }
}
```

---

### Stats

#### `GET /api/stats`

Dashboard statistics for the admin view.

**Response:**

```json
{
    "success": true,
    "data": {
        "total_articles": 1542,
        "total_sources": 62,
        "articles_today": 47,
        "articles_this_week": 312,
        "sources_by_status": { "active": 58, "paused": 3, "deprecated": 1 },
        "sources_by_category": { "research": 8, "social": 6, "code": 6, "news": 14, "company": 11, "conference": 8, "benchmark": 3, "podcast": 5 },
        "articles_by_content_type": { "paper": 450, "blog": 320, "news": 280, "social": 210, "code": 120, "video": 90, "newsletter": 72 },
        "read_rate": 0.42,
        "avg_engagement_score": 65.3
    },
    "error": null
}
```

---

### Health

#### `GET /api/health`

Health check endpoint for monitoring.

**Response:**

```json
{
    "success": true,
    "data": {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": "2026-03-15T12:00:00Z",
        "services": {
            "database": "connected",
            "cache": "connected"
        }
    },
    "error": null
}
```

---

## 4. Next.js Project Structure

```
src/
├── app/                              # Pages + API routes (App Router)
│   ├── page.tsx                      # Home -- article feed view
│   ├── layout.tsx                    # Root layout (Header, MobileNav, providers)
│   ├── loading.tsx                   # Global loading skeleton
│   ├── error.tsx                     # Global error boundary
│   ├── not-found.tsx                 # 404 page
│   ├── digest/
│   │   └── page.tsx                  # Daily/weekly digest view
│   ├── saved/
│   │   └── page.tsx                  # Saved/bookmarked articles
│   ├── history/
│   │   └── page.tsx                  # Read history
│   ├── sources/
│   │   ├── page.tsx                  # Source dashboard (list, filter, manage)
│   │   └── [id]/
│   │       └── page.tsx              # Source detail (articles from source, stats)
│   ├── discover/
│   │   └── page.tsx                  # Source discovery and candidate review
│   └── api/
│       ├── articles/
│       │   ├── route.ts              # GET /api/articles
│       │   ├── search/
│       │   │   └── route.ts          # GET /api/articles/search
│       │   └── [id]/
│       │       ├── route.ts          # GET /api/articles/[id]
│       │       ├── read/
│       │       │   └── route.ts      # POST /api/articles/[id]/read
│       │       ├── save/
│       │       │   └── route.ts      # POST /api/articles/[id]/save
│       │       └── rate/
│       │           └── route.ts      # POST /api/articles/[id]/rate
│       ├── sources/
│       │   ├── route.ts              # GET, POST /api/sources
│       │   └── [id]/
│       │       ├── route.ts          # PATCH /api/sources/[id]
│       │       ├── status/
│       │       │   └── route.ts      # PATCH /api/sources/[id]/status
│       │       └── rate/
│       │           └── route.ts      # GET, POST /api/sources/[id]/rate
│       ├── filter-presets/
│       │   ├── route.ts              # GET, POST /api/filter-presets
│       │   └── [id]/
│       │       └── route.ts          # DELETE /api/filter-presets/[id]
│       ├── digest/
│       │   └── route.ts              # GET /api/digest
│       ├── stats/
│       │   └── route.ts              # GET /api/stats
│       └── health/
│           └── route.ts              # GET /api/health
├── components/
│   ├── ui/                           # Shared primitive components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Chip.tsx
│   │   ├── Input.tsx
│   │   ├── Skeleton.tsx
│   │   ├── StarRating.tsx
│   │   ├── ThumbsRating.tsx
│   │   └── Modal.tsx
│   ├── layout/                       # App shell components
│   │   ├── Header.tsx
│   │   ├── MobileNav.tsx
│   │   ├── Sidebar.tsx
│   │   └── PageContainer.tsx
│   ├── articles/                     # Article-related components
│   │   ├── ArticleCard.tsx
│   │   ├── ArticleFeed.tsx
│   │   ├── ArticleDetail.tsx
│   │   └── ArticleSkeleton.tsx
│   ├── search/                       # Search components
│   │   └── SearchBar.tsx
│   ├── filters/                      # Filter components
│   │   ├── FilterBar.tsx
│   │   ├── FilterChip.tsx
│   │   └── FilterPanel.tsx
│   ├── sources/                      # Source management components
│   │   ├── SourceTable.tsx
│   │   ├── SourceForm.tsx
│   │   ├── SourceDetail.tsx
│   │   └── QualityAlert.tsx
│   └── digest/                       # Digest view components
│       └── DigestCard.tsx
├── lib/
│   ├── supabase/                     # Supabase client and types
│   │   ├── client.ts                 # createClient() for server and browser
│   │   └── types.ts                  # Generated Supabase types (Database interface)
│   ├── repositories/                 # Data access layer (Repository pattern)
│   │   ├── sources.ts                # findAll, findById, create, update, updateStatus
│   │   ├── articles.ts              # findAll (filtered), findById, search, markRead, toggleSave
│   │   ├── preferences.ts           # rateArticle, getArticleRating
│   │   ├── source-ratings.ts        # rateSource, getSourceRating
│   │   └── filter-presets.ts        # findAll, create, remove
│   ├── schemas/                      # Zod validation schemas
│   │   ├── articles.ts              # articleQuerySchema, articleRateSchema
│   │   ├── sources.ts               # createSourceSchema, updateSourceSchema
│   │   └── filter-presets.ts        # createPresetSchema
│   ├── ranking/                      # Ranking and scoring logic
│   │   ├── score.ts                  # computeRankingScore(source_reliability, recency, engagement)
│   │   └── preferences.ts           # applyPreferenceBoost(articles, userHistory)
│   ├── cache/                        # Upstash Redis caching utilities
│   │   ├── client.ts                 # Redis client initialization
│   │   ├── keys.ts                   # Cache key generators
│   │   └── middleware.ts             # withCache() wrapper for API handlers
│   └── hooks/                        # React custom hooks
│       ├── useArticles.ts            # SWR/React Query hook for article feed
│       ├── useFilters.ts             # Filter state management
│       ├── useDebounce.ts            # Debounced value hook (search)
│       └── useSources.ts             # SWR/React Query hook for sources
├── types/
│   ├── article.ts                    # Article, ArticleWithSource types
│   ├── source.ts                     # Source type
│   ├── filter.ts                     # FilterConfig, FilterPreset types
│   └── api.ts                        # ApiResponse<T>, PaginationMeta types
└── constants/
    ├── content-types.ts              # CONTENT_TYPES enum/array
    ├── platforms.ts                   # PLATFORMS enum/array
    ├── topics.ts                      # TOPIC_TAGS list
    └── time-ranges.ts                # TIME_RANGE options
```

---

## 5. Python Ingestion Structure

### Folder Tree

```
ingestion/
├── fetchers/                         # One module per data source
│   ├── __init__.py
│   ├── base.py                       # BaseFetcher abstract class
│   ├── reddit.py                     # Reddit OAuth API (r/MachineLearning, r/LocalLLaMA, r/artificial)
│   ├── hackernews.py                 # HN Algolia API (search_by_date, tag=story, AI filter)
│   ├── github.py                     # GitHub REST API (trending via search, releases)
│   ├── arxiv.py                      # ArXiv API (cs.AI, cs.LG, cs.CL, cs.CV)
│   ├── youtube.py                    # YouTube Data API v3 (channel playlists)
│   ├── rss.py                        # Generic RSS/Atom fetcher (feedparser)
│   ├── huggingface.py                # HuggingFace Hub API (models, papers, spaces)
│   ├── semantic_scholar.py           # Semantic Scholar API (paper search, TLDRs)
│   ├── papers_with_code.py           # Papers With Code API
│   ├── lobsters.py                   # Lobsters JSON endpoints
│   ├── pypi.py                       # PyPI RSS + JSON API
│   └── scraper.py                    # Generic web scraper (BeautifulSoup, fallback)
├── pipeline/
│   ├── __init__.py
│   ├── normalizer.py                 # Convert source-specific data to uniform ArticleMetadata
│   ├── deduplicator.py               # URL exact match + fuzzy title matching (via Redis)
│   ├── tagger.py                     # Auto-assign topic tags from keywords, categories
│   └── scorer.py                     # Compute initial engagement_score
├── config/
│   ├── sources.json                  # Source registry (URLs, API params, fetch frequencies)
│   └── settings.py                   # Environment variables, Supabase/Redis config
├── db/
│   ├── __init__.py
│   └── supabase_client.py            # Supabase Python client (insert articles, update sources)
├── run.py                            # Main entry point -- orchestrates fetch -> pipeline -> store
├── run_wave1.py                      # Entry point for Wave 1 sources only (HN, ArXiv, RSS, Lobsters)
├── run_wave2.py                      # Entry point for Wave 2 sources (HF, PwC, S2, PyPI)
├── run_wave3.py                      # Entry point for Wave 3 sources (GitHub, Reddit, YouTube)
├── requirements.txt                  # Python dependencies
└── tests/
    ├── __init__.py
    ├── test_fetchers.py              # Unit tests for each fetcher
    ├── test_normalizer.py            # Tests for metadata normalization
    ├── test_deduplicator.py          # Tests for dedup logic
    ├── test_tagger.py                # Tests for auto-tagging
    └── test_scorer.py                # Tests for scoring formula
```

### Pipeline Flow

1. **`run.py`** reads the active sources from `config/sources.json` (or queries Supabase for active sources).
2. For each source, it instantiates the appropriate **fetcher** based on `type` and `platform`.
3. Each fetcher returns a list of raw items in its native format.
4. The **normalizer** transforms each raw item into a uniform `ArticleMetadata` dataclass:
   ```
   { title, url, source_id, published_at, summary_snippet, content_type, platform, engagement_metrics }
   ```
5. The **deduplicator** checks each URL against Redis (exact match) and runs fuzzy title matching against recently fetched titles to discard duplicates.
6. The **tagger** assigns `topic_tags[]` based on keyword matching, subreddit names, ArXiv categories, and GitHub repo topics.
7. The **scorer** computes an initial `engagement_score` using: `source_reliability * recency_decay * normalized_engagement`.
8. The **Supabase client** performs a batch upsert of new articles and updates `last_fetched` on the source record.

---

## 6. Caching Strategy (Upstash Redis)

### What Gets Cached

| Cache Type | Key Pattern | TTL | Description |
|-----------|-------------|-----|-------------|
| Article feed pages | `feed:{filter_hash}:{cursor}` | 5 minutes | Cached API responses for filtered article lists |
| Single article | `article:{id}` | 15 minutes | Individual article lookups |
| Source list | `sources:{filter_hash}` | 10 minutes | Cached source list queries |
| Digest | `digest:{period}:{date}` | 1 hour | Daily/weekly digest results |
| Stats | `stats` | 10 minutes | Dashboard statistics |
| Search results | `search:{query_hash}:{cursor}` | 5 minutes | Full-text search results |
| Dedup URL set | `dedup:urls` | 7 days | Set of recently fetched URLs for deduplication |
| Dedup title hashes | `dedup:titles:{date}` | 3 days | Fuzzy title hashes for duplicate detection |
| Health check | `health` | 1 minute | Service health status |

### Cache Invalidation Strategy

| Trigger | Invalidation Action |
|---------|-------------------|
| New articles ingested (pipeline completes) | Invalidate `feed:*`, `digest:*`, `stats`, `search:*` |
| Article marked read/saved/rated | Invalidate `article:{id}`, `feed:*` containing that article |
| Source created/updated/status changed | Invalidate `sources:*`, `stats` |
| Source rated | Invalidate `sources:*` |
| Filter preset created/deleted | Invalidate nothing (presets are user-specific, low volume) |

### Implementation Notes

- Use `@upstash/redis` in Next.js API routes for read-through caching.
- Use `redis-py` (with Upstash REST) in Python ingestion scripts for dedup lookups and invalidation.
- The `withCache()` middleware wraps API route handlers: check cache first, return cached response or execute handler and cache the result.
- All cache keys include a version prefix (`v1:`) to allow schema changes without stale data.
- Respect Upstash free tier limits (10,000 commands/day) by keeping TTLs reasonable and avoiding cache stampedes.

---

## 7. GitHub Actions Workflows

### Workflow Files

```
.github/workflows/
├── ingest-wave1.yml          # Wave 1: HN, ArXiv, RSS, Lobsters
├── ingest-wave2.yml          # Wave 2: HuggingFace, Papers With Code, Semantic Scholar, PyPI
├── ingest-wave3.yml          # Wave 3: GitHub, Reddit, YouTube
├── ci.yml                    # Lint, type check, test (on push/PR)
└── deploy.yml                # Deploy to Vercel (on push to main)
```

### Cron Schedules

| Workflow | Cron Expression | Frequency | Sources | Description |
|----------|----------------|-----------|---------|-------------|
| `ingest-wave1.yml` | `0 */4 * * *` | Every 4 hours | Hacker News, ArXiv, RSS feeds (blogs, newsletters, company blogs), Lobsters | Backbone sources with no auth required |
| `ingest-wave2.yml` | `0 */6 * * *` | Every 6 hours | HuggingFace Hub, Papers With Code, Semantic Scholar, PyPI | Research-focused sources with simple or no auth |
| `ingest-wave3.yml` | `0 */6 * * *` | Every 6 hours | GitHub Trending/Releases, Reddit (3 subreddits), YouTube (AI channels) | Sources requiring OAuth / API keys |
| `ci.yml` | On push/PR | Per event | N/A | Runs `npm run lint`, `npm run typecheck`, `npm run test`, `cd ingestion && pytest` |
| `deploy.yml` | On push to `main` | Per event | N/A | Triggers Vercel deployment via Vercel CLI or GitHub integration |

### Workflow Details

**`ingest-wave1.yml`** (example structure):
- Checks out the repo
- Sets up Python 3.12
- Installs `ingestion/requirements.txt`
- Runs `python ingestion/run_wave1.py`
- On failure: posts a notification (optional GitHub issue or Slack webhook)

**`ci.yml`**:
- Runs on every push and pull request
- Matrix: Node.js 20 + Python 3.12
- Steps: install deps, lint (ESLint + Ruff), type check (tsc --noEmit), unit tests (Vitest + pytest), coverage check (80% threshold)

**`deploy.yml`**:
- Triggered on push to `main` (after CI passes)
- Uses Vercel CLI or Vercel GitHub integration for automatic deployment
- Runs `vercel --prod` with environment variables from GitHub Secrets

---

## 8. Environment Variables

### Next.js / Vercel

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public, used in browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, bypasses RLS) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token |
| `NODE_ENV` | `development` or `production` |

### Python Ingestion / GitHub Actions Secrets

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for inserting articles) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (for dedup cache) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `REDDIT_CLIENT_ID` | Reddit OAuth app client ID |
| `REDDIT_CLIENT_SECRET` | Reddit OAuth app client secret |
| `REDDIT_USER_AGENT` | Reddit API user agent string (e.g., `llm-news-aggregator/1.0`) |
| `GITHUB_PAT` | GitHub personal access token (for 5,000 req/hr) |
| `YOUTUBE_API_KEY` | Google Cloud YouTube Data API v3 key |
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar API key (optional, for stable rate limits) |
| `HUGGINGFACE_TOKEN` | HuggingFace Hub API token (optional, for higher rate limits) |

### Optional / Future

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry error tracking DSN (Phase 5) |
| `VERCEL_TOKEN` | Vercel CLI deploy token (if using CLI-based deploy) |
| `DISCORD_BOT_TOKEN` | Discord bot token for community monitoring (Wave 4) |
