# Implementation Plan: LLM News Aggregator

## Requirements Restatement

Build a **$0/month** AI news aggregator that:
- Discovers, ranks, and links to AI/ML content from 60+ sources — never stores article content
- Mobile-first, modern UI with Tailwind CSS
- Comprehensive filtering (7 dimensions), source management dashboard, source discovery with rating gate
- Personalization via thumbs up/down + source star ratings
- Two-service architecture: Next.js on Vercel (web) + Python on GitHub Actions (ingestion)
- Supabase (Postgres + Auth), Upstash Redis (cache)
- Single-user MVP first, multi-user later

---

## Risks & Blockers

| Risk | Severity | Mitigation |
|---|---|---|
| Supabase free tier row limit (50K) | HIGH | Aggressive dedup, TTL on old articles, archive strategy |
| GitHub Actions cron unreliable timing | MEDIUM | Design for eventual consistency, not real-time |
| Reddit/GitHub API rate limits | MEDIUM | Respect rate limits, cache responses, stagger fetches |
| Upstash 10K commands/day limit | MEDIUM | Cache only hot paths (dedup, rate limiting), not all reads |
| RSS feeds disappearing or changing format | LOW | Graceful failure per source, staleness detection |
| Supabase free tier pauses after 1 week inactivity | HIGH | GitHub Actions cron keeps it alive by writing regularly |

---

## Phase 0 — Research & Planning (NO CODE)

**Goal**: Answer all open questions, finalize architecture, create PRD.

### 0.1 — Competitor Research
- **What**: Research existing AI aggregators (Daily.dev, TLDR, Papers With Code, Hugging Face Papers daily, AI News)
- **Deliverable**: `docs/research/competitors.md` — what they do well, what they miss, gaps we fill
- **Agent**: `deep-research` skill

### 0.2 — Source API Feasibility Audit
- **What**: For each of the 60+ sources, confirm: API availability, rate limits, auth requirements, free tier limits, data format
- **Deliverable**: `docs/research/source-api-audit.md` — table with every source and its feasibility status
- **Agent**: `deep-research` skill
- **Priority sources to validate first** (these are the backbone):
  1. Hacker News Algolia API (free, no auth)
  2. Reddit API (free tier, OAuth required)
  3. GitHub API (free, token for higher limits)
  4. ArXiv API (free, no auth)
  5. HuggingFace API (free, token optional)
  6. YouTube Data API (free, quota-based)
  7. RSS feeds for blogs/newsletters (free, no auth)

### 0.3 — Architecture Document
- **What**: Finalize data flow, Supabase schema, API contract, ingestion pipeline design
- **Deliverable**: `docs/architecture.md`
- **Agent**: `architect` agent
- **Key decisions to document**:
  - Supabase schema (exact SQL for all tables, indexes, constraints)
  - API route structure (REST endpoints, request/response shapes)
  - Ingestion pipeline data flow (per-source fetch → normalize → dedup → tag → score → store)
  - Caching strategy (what goes in Redis, TTLs)
  - File/folder structure for both Next.js app and Python ingestion

### 0.4 — PRD (Product Requirements Document)
- **What**: Formalize all features, user stories, acceptance criteria
- **Deliverable**: `docs/prd.md`
- **Agent**: `planner` agent
- **Must include**:
  - User stories for each feature
  - Acceptance criteria per story
  - Out-of-scope items per phase
  - Success metrics

### 0.5 — Name the Website
- **What**: Brainstorm and decide on a project name
- **Deliverable**: Name decided, README updated
- **Requires**: User input

**Phase 0 Exit Criteria**: All docs written, user has approved architecture and PRD.

---

## Phase 1 — Foundation (Backend Core)

**Goal**: Working backend with database, API routes, and ingestion pipeline. No UI yet.

### 1.1 — Project Scaffolding
- **What**: Initialize the repo with all tooling configured
- **Tasks**:
  - `npx create-next-app@latest` with App Router, TypeScript, Tailwind, ESLint
  - Configure `tailwind.config.ts` with custom design tokens (colors, fonts, spacing)
  - Add Vitest + React Testing Library for unit tests
  - Add Playwright for E2E tests
  - Configure ESLint + Prettier
  - Set up `tsconfig.json` with strict mode
  - Create folder structure:
    ```
    src/
    ├── app/           # Next.js App Router pages + API routes
    ├── lib/           # Shared utilities, Supabase client, Zod schemas
    ├── components/    # React components (Phase 2)
    ├── types/         # TypeScript type definitions
    └── constants/     # Enums, config values
    ```
  - Create `.env.example` with all required env vars
  - Create `.github/workflows/ci.yml` (lint + type-check + test)
- **Deliverable**: Repo builds, lints, and passes empty test suite
- **Branch**: `feature/1.1-project-scaffolding`
- **Dependencies**: None

### 1.2 — Supabase Database Schema
- **What**: Create all tables, indexes, and seed data in Supabase
- **Tasks**:
  - Create Supabase project (free tier)
  - Write SQL migration for `sources` table:
    ```sql
    sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,        -- 'research','social','code','news','company','conference','people','benchmark','podcast'
      type TEXT NOT NULL,             -- 'api','rss','scrape','manual'
      status TEXT NOT NULL DEFAULT 'active',  -- 'active','paused','deprecated'
      platform TEXT,                  -- 'reddit','hackernews','github','arxiv','youtube','linkedin','x','blog'
      added_on TIMESTAMPTZ DEFAULT now(),
      last_fetched TIMESTAMPTZ,
      fetch_frequency TEXT NOT NULL DEFAULT 'daily', -- 'hourly','4h','6h','12h','daily','weekly'
      reliability_score NUMERIC(3,2) DEFAULT 0.00,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
    ```
  - Write SQL migration for `articles` table:
    ```sql
    articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
      published_at TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ DEFAULT now(),
      summary_snippet TEXT,
      content_type TEXT NOT NULL,     -- 'paper','blog','news','social','code','newsletter','video','benchmark'
      topic_tags TEXT[] DEFAULT '{}',
      platform TEXT,
      engagement_score NUMERIC DEFAULT 0,
      engagement_metrics JSONB DEFAULT '{}',
      recommendation_reason TEXT,
      is_read BOOLEAN DEFAULT false,
      is_saved BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
    ```
  - Write SQL migration for `article_preferences` table:
    ```sql
    article_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
      rating TEXT NOT NULL,           -- 'up','down'
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(article_id)             -- one preference per article (V1 single-user)
    )
    ```
  - Write SQL migration for `source_ratings` table:
    ```sql
    source_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
      star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(source_id)              -- one rating per source (V1 single-user)
    )
    ```
  - Write SQL migration for `filter_presets` table:
    ```sql
    filter_presets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      filter_config JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
    ```
  - Create indexes: `articles(source_id)`, `articles(published_at DESC)`, `articles(content_type)`, `articles(platform)`, GIN index on `articles(topic_tags)`
  - Seed `sources` table with the initial 60+ sources from CLAUDE.md
  - Write migration files in `supabase/migrations/`
- **Deliverable**: All tables created in Supabase, seed data loaded
- **Tests**: Integration tests that verify schema, constraints, and indexes
- **Branch**: `feature/1.2-database-schema`
- **Dependencies**: 1.1

### 1.3 — Supabase Client & Repository Layer
- **What**: TypeScript client for all database operations
- **Tasks**:
  - Install `@supabase/supabase-js`
  - Create `src/lib/supabase/client.ts` — server and client Supabase instances
  - Create `src/lib/supabase/types.ts` — auto-generated types from Supabase CLI (`supabase gen types`)
  - Create repository modules:
    - `src/lib/repositories/sources.ts` — `getAll`, `getById`, `create`, `update`, `updateStatus`, `getByCategory`, `getStale`
    - `src/lib/repositories/articles.ts` — `getAll` (with cursor pagination + filters), `getById`, `create`, `batchCreate`, `markRead`, `toggleSave`, `getUnread`, `getSaved`
    - `src/lib/repositories/preferences.ts` — `rate`, `getByArticle`, `getAll`
    - `src/lib/repositories/source-ratings.ts` — `rate`, `getBySource`, `getAll`
    - `src/lib/repositories/filter-presets.ts` — `getAll`, `create`, `update`, `delete`
  - All repository functions return immutable data (spread into new objects)
  - All functions use parameterized queries (Supabase client handles this)
- **Deliverable**: Full repository layer with TypeScript types
- **Tests**: Unit tests for each repository function (mock Supabase client)
- **Branch**: `feature/1.3-repository-layer`
- **Dependencies**: 1.1, 1.2

### 1.4 — API Routes
- **What**: Next.js API routes for all CRUD operations
- **Tasks**:
  - Create Zod schemas in `src/lib/schemas/`:
    - `source.schema.ts` — create, update, filter params
    - `article.schema.ts` — filter params (content_type, platform, time_range, quality, topic, engagement, read_status), pagination cursor
    - `preference.schema.ts` — rate (up/down)
    - `source-rating.schema.ts` — rate (1–5)
    - `filter-preset.schema.ts` — create, update
  - Create API routes:
    - `GET /api/sources` — list all sources (filter by category, status)
    - `POST /api/sources` — add new source
    - `PATCH /api/sources/[id]` — update source
    - `PATCH /api/sources/[id]/status` — pause/activate/deprecate
    - `GET /api/articles` — list articles with full filter support + cursor pagination
    - `GET /api/articles/[id]` — single article
    - `POST /api/articles/[id]/read` — mark as read
    - `POST /api/articles/[id]/save` — toggle save
    - `POST /api/articles/[id]/rate` — thumbs up/down
    - `GET /api/sources/[id]/rate` — get source rating
    - `POST /api/sources/[id]/rate` — star rating (1–5)
    - `GET /api/filter-presets` — list presets
    - `POST /api/filter-presets` — create preset
    - `DELETE /api/filter-presets/[id]` — delete preset
    - `GET /api/stats` — dashboard stats (total sources, articles today, unread count)
  - All routes validate input with Zod, return consistent envelope `{ success, data, error, meta }`
  - Error handling middleware with appropriate status codes
- **Deliverable**: All API routes working, tested
- **Tests**: Integration tests for each route (happy path + error cases)
- **Branch**: `feature/1.4-api-routes`
- **Dependencies**: 1.3

### 1.5 — Python Ingestion Pipeline
- **What**: Python scripts that fetch from sources and write metadata to Supabase
- **Tasks**:
  - Set up `ingestion/` folder structure (as defined in CLAUDE.md)
  - Create `requirements.txt`: `httpx`, `feedparser`, `beautifulsoup4`, `supabase`, `python-dotenv`, `pytest`, `thefuzz` (for fuzzy dedup)
  - Implement base fetcher interface (`BaseFetcher` abstract class):
    ```python
    class BaseFetcher(ABC):
        @abstractmethod
        async def fetch(self, source: Source) -> list[RawArticle]: ...
    ```
  - Implement fetchers (start with the 3 easiest, add more incrementally):
    - **hackernews.py** — HN Algolia API (free, no auth, well-documented) — **START HERE**
    - **rss.py** — Generic RSS fetcher (covers blogs, newsletters, company blogs)
    - **reddit.py** — Reddit API (OAuth, free tier)
    - *(remaining fetchers: github.py, arxiv.py, youtube.py, huggingface.py, scraper.py — add in later sub-phases)*
  - Implement pipeline modules:
    - **normalizer.py** — converts `RawArticle` → `NormalizedArticle` (uniform schema)
    - **deduplicator.py** — URL exact match + fuzzy title match (thefuzz, threshold 90%)
    - **tagger.py** — keyword-based topic assignment (map keywords → topic tags)
    - **scorer.py** — initial score = source_reliability × recency_decay × engagement_normalized
  - Implement `run.py` — orchestrates: load sources → fetch → normalize → dedup → tag → score → batch insert to Supabase
  - Create GitHub Actions workflows:
    - `.github/workflows/ingest-frequent.yml` — `cron: '0 */4 * * *'` for HN, Reddit
    - `.github/workflows/ingest-daily.yml` — `cron: '0 8 * * *'` for ArXiv, blogs, newsletters
    - Both with `workflow_dispatch` for manual triggering
  - All scripts use environment variables for secrets (`SUPABASE_URL`, `SUPABASE_KEY`, `REDDIT_CLIENT_ID`, etc.)
- **Deliverable**: Working ingestion for HN + RSS + Reddit, data flowing into Supabase
- **Tests**: Unit tests for each fetcher (mocked API responses), normalizer, deduplicator, scorer
- **Branch**: `feature/1.5-ingestion-pipeline`
- **Dependencies**: 1.2 (needs Supabase schema)

### 1.6 — Phase 1 Code Review & Security Audit
- **What**: Review all Phase 1 code before moving to frontend
- **Tasks**:
  - Run `code-reviewer` agent on all TypeScript code
  - Run `python-review` agent on all Python code
  - Run `security-reviewer` agent — verify no secrets in code, inputs validated, no SQL injection
  - Fix all CRITICAL and HIGH issues
  - Run `verification-loop` — build + types + lint + tests + security
  - Verify 80%+ test coverage
- **Deliverable**: Clean, reviewed, secure Phase 1 code
- **Branch**: `feature/1.6-phase1-review`
- **Dependencies**: 1.1–1.5 all complete

### 1.7 — UI Wireframes & Mockups
- **What**: Create rough clickable wireframes so the user can review the design before Phase 2 coding begins
- **Tasks**:
  - Create a `wireframes/` folder with static HTML + Tailwind pages (no backend integration)
  - Build wireframe pages for:
    - Article feed (mobile + desktop)
    - Source management dashboard (mobile + desktop)
    - Digest page
    - Search results
    - Filter panel (mobile bottom sheet + desktop sidebar)
    - Saved articles page
  - Use placeholder/mock data to simulate real content
  - Deploy wireframes to a Vercel preview URL for user review
  - **USER CHECKPOINT**: Get explicit user approval on layout, navigation, and visual direction before proceeding to Phase 2
- **Deliverable**: Clickable wireframes viewable in browser at all viewport sizes
- **Branch**: `feature/1.7-wireframes`
- **Dependencies**: 1.1 (Tailwind config)

**Phase 1 Exit Criteria**:
- [ ] Next.js app builds and passes all tests
- [ ] Supabase schema deployed with seed data
- [ ] All API routes working with validation
- [ ] Ingestion running for HN + RSS + Reddit
- [ ] Data visible in Supabase dashboard
- [ ] 80%+ test coverage
- [ ] Code reviewed and security audited

---

## Phase 2 — Frontend (Mobile-First UI with Tailwind)

**Goal**: Usable mobile-first website showing real data from the database.

### 2.1 — Design System & Tailwind Config
- **What**: Define visual language before building components
- **Tasks**:
  - Configure `tailwind.config.ts`:
    - Color palette (primary, secondary, accent, neutral, success, warning, error)
    - Typography scale (headings, body, caption)
    - Spacing scale
    - Border radius tokens
    - Dark mode (class strategy)
    - Custom breakpoints if needed (default `sm:640`, `md:768`, `lg:1024`, `xl:1280`)
  - Create `src/components/ui/` — shared primitives:
    - `Button.tsx` — variants via `cva` (primary, secondary, ghost, danger; sizes sm/md/lg)
    - `Card.tsx` — content card container
    - `Badge.tsx` — topic tags, status indicators
    - `Chip.tsx` — filter toggle chips
    - `Input.tsx` — text input with Zod validation display
    - `Skeleton.tsx` — loading skeleton via `animate-pulse`
    - `EmptyState.tsx` — "no results" display
  - **USER CHECKPOINT**: Show design token choices and component mockups, get approval before proceeding
- **Deliverable**: Design system + shared UI components
- **Tests**: Unit tests for all UI components (render, variants, accessibility)
- **Branch**: `feature/2.1-design-system`
- **Dependencies**: 1.1

### 2.2 — Layout Shell
- **What**: App-level layout with navigation, responsive to all screen sizes
- **Tasks**:
  - `src/app/layout.tsx` — root layout with Tailwind, fonts, metadata
  - `src/components/layout/Header.tsx` — logo, nav links, search trigger, dark mode toggle
  - `src/components/layout/MobileNav.tsx` — bottom tab bar for mobile (Feed, Search, Sources, Saved)
  - `src/components/layout/Sidebar.tsx` — desktop sidebar with nav + quick filters (hidden on mobile)
  - Responsive behavior:
    - Mobile (`< sm`): bottom tab nav, full-width content, no sidebar
    - Tablet (`md`): collapsible sidebar, wider content area
    - Desktop (`lg+`): persistent sidebar, wide content area
  - **USER CHECKPOINT**: Show layout on mobile vs desktop, get approval
- **Deliverable**: Responsive shell renders on all screen sizes
- **Tests**: E2E test verifying layout renders at different viewports
- **Branch**: `feature/2.2-layout-shell`
- **Dependencies**: 2.1

### 2.3 — Article Feed (Core Page)
- **What**: The main feed page showing ranked articles
- **Tasks**:
  - `src/app/page.tsx` — home page (article feed)
  - `src/components/articles/ArticleCard.tsx`:
    - Title (clickable → original URL)
    - Source name + platform icon
    - Published time (relative: "2h ago", "Yesterday")
    - Summary snippet (2 lines max, truncated)
    - Topic tags as Badges
    - Recommendation reason text
    - Thumbs up/down buttons
    - Save button
    - "Read" link → opens original URL in new tab
  - `src/components/articles/ArticleFeed.tsx`:
    - Virtualized list using `@tanstack/react-virtual` for performance
    - Infinite scroll with cursor-based pagination
    - Loading skeletons while fetching
    - Empty state when no articles match
  - Data fetching via React Query (`@tanstack/react-query`):
    - `useArticles(filters)` — fetches articles with filter params
    - `useArticleRate(id)` — mutation for thumbs up/down
    - `useArticleSave(id)` — mutation for save toggle
    - `useArticleRead(id)` — mutation for mark as read
  - **USER CHECKPOINT**: Show article card design on mobile, get approval
- **Deliverable**: Working feed page showing real articles from Supabase
- **Tests**: Unit tests for ArticleCard, integration tests for data fetching hooks
- **Branch**: `feature/2.3-article-feed`
- **Dependencies**: 2.2, 1.4 (API routes)

### 2.4 — Search
- **What**: Search bar with debounced full-text search
- **Tasks**:
  - `src/components/search/SearchBar.tsx` — input with debounce (300ms), clear button, search icon
  - `src/lib/hooks/useDebounce.ts` — generic debounce hook
  - Add `GET /api/articles/search?q=` API route — Supabase full-text search on title + summary
  - Search results page or inline results in feed
  - Mobile: search bar expands from icon tap, full-width overlay
  - Desktop: search bar in header, results inline
- **Deliverable**: Working search with debounce
- **Tests**: Unit test for debounce hook, integration test for search API
- **Branch**: `feature/2.4-search`
- **Dependencies**: 2.3

### 2.5 — Filter System
- **What**: All 7 filter dimensions with combinable, saveable presets
- **Tasks**:
  - `src/components/filters/FilterBar.tsx` — horizontal scrollable chip bar (mobile), sidebar panel (desktop)
  - `src/components/filters/FilterChip.tsx` — toggle chip for each filter value
  - `src/components/filters/FilterPanel.tsx` — full filter panel (slide-up on mobile, sidebar section on desktop)
  - Filter state management:
    - `src/lib/hooks/useFilters.ts` — manages active filters, combines them, syncs to URL params
    - URL-based filter state (`?content_type=paper&time=week&quality=top`) for shareable/bookmarkable URLs
  - Filter categories implemented:
    - Content Type (8 options)
    - Source Platform (8 options)
    - Time Range (4 options + custom date picker)
    - Quality/Rating (3 options)
    - Topic/Domain (10 options)
    - Engagement (4 options)
    - Read Status (3 options)
  - Filter presets:
    - "Save current filters" → creates named preset via API
    - Quick-access preset chips
    - Preset management (rename, delete)
  - Clear all button, active filter count badge
  - **USER CHECKPOINT**: Show filter UX on mobile (chip bar + slide-up panel), get approval
- **Deliverable**: Full filter system working with all 7 dimensions
- **Tests**: Unit tests for filter logic, E2E test for filter combinations
- **Branch**: `feature/2.5-filters`
- **Dependencies**: 2.3

### 2.6 — Source Management Dashboard
- **What**: Admin page to view, edit, and manage sources
- **Tasks**:
  - `src/app/sources/page.tsx` — source listing page
  - `src/components/sources/SourceTable.tsx` — table/list of all sources with:
    - Name, URL, category, platform, status, last fetched, reliability score
    - Quick action buttons: pause, activate, deprecate
    - Filter by category/status
    - Sort by name/score/last fetched
  - `src/components/sources/SourceForm.tsx` — add/edit source form:
    - URL input with auto-detection of feed type
    - Category dropdown
    - Fetch frequency selector
    - Notes textarea
  - `src/components/sources/SourceDetail.tsx` — detail view showing:
    - Source metadata
    - Recent articles from this source
    - Star rating (1–5)
    - Performance stats (articles fetched, thumbs up/down ratio)
  - Mobile: source list as cards, swipe actions
  - Desktop: table layout with inline actions
- **Deliverable**: Full source management UI
- **Tests**: Unit tests for components, E2E test for add/edit/pause flow
- **Branch**: `feature/2.6-source-dashboard`
- **Dependencies**: 2.2, 1.4

### 2.7 — Daily Digest View
- **What**: "Top 10 things to read today" curated view
- **Tasks**:
  - `src/app/digest/page.tsx` — daily digest page
  - `src/components/digest/DigestCard.tsx` — numbered card (1–10) with title, source, one-line summary, read link
  - `GET /api/digest` API route — returns top 10 articles for today based on score
  - Option to switch between daily and weekly digest
  - Mobile-optimized: swipeable cards or simple numbered list
- **Deliverable**: Working digest page
- **Tests**: Unit tests, API integration test
- **Branch**: `feature/2.7-digest`
- **Dependencies**: 2.3

### 2.8 — Saved Articles & Read History
- **What**: Pages for bookmarked articles and read history
- **Tasks**:
  - `src/app/saved/page.tsx` — saved articles list (reuses ArticleFeed with `is_saved=true` filter)
  - `src/app/history/page.tsx` — read history (reuses ArticleFeed with `is_read=true` filter)
  - Badge on nav showing unread saved count
- **Deliverable**: Saved and history pages
- **Tests**: E2E tests for save/unsave flow
- **Branch**: `feature/2.8-saved-history`
- **Dependencies**: 2.3

### 2.9 — Phase 2 E2E Tests & Code Review
- **What**: Comprehensive E2E tests and full code review
- **Tasks**:
  - Write Playwright E2E tests:
    - Browse article feed on mobile viewport
    - Search for articles
    - Apply filter combination
    - Save a filter preset
    - Thumbs up an article
    - Save an article for later
    - View daily digest
    - Manage sources (add, pause, rate)
  - Run `code-reviewer` agent on all frontend code
  - Run `e2e-runner` agent
  - Run `verification-loop`
  - Verify 80%+ coverage
- **Deliverable**: All E2E tests passing, code reviewed
- **Branch**: `feature/2.9-phase2-review`
- **Dependencies**: 2.1–2.8 all complete

**Phase 2 Exit Criteria**:
- [ ] Website renders on mobile and desktop
- [ ] Article feed with real data, infinite scroll
- [ ] Search working with debounce
- [ ] All 7 filter dimensions working and combinable
- [ ] Source dashboard with CRUD operations
- [ ] Daily digest page
- [ ] Saved articles and read history
- [ ] All E2E tests passing
- [ ] 80%+ test coverage
- [ ] Code reviewed

---

## Phase 3 — Personalization & Feedback

**Goal**: Feed gets smarter based on user behavior.

### 3.1 — Feedback UI Polish
- **What**: Refine thumbs up/down and star rating interactions
- **Tasks**:
  - Animated thumb icons (bounce on tap)
  - Undo capability (5s window after rating)
  - Star rating component for sources (tap to rate, half-star support optional)
  - Toast notification: "Thanks! We'll show you more like this"
- **Deliverable**: Polished feedback UI
- **Branch**: `feature/3.1-feedback-ui`
- **Dependencies**: 2.3

### 3.2 — Re-Ranking Algorithm
- **What**: Adjust article scoring based on accumulated preferences
- **Tasks**:
  - Create `src/lib/ranking/score.ts`:
    - `calculateScore(article, sourceRating, userPreferences)`:
      - Base score = `source_reliability × recency_decay × engagement_normalized`
      - Preference boost: articles from thumbs-up'd sources get +20% boost
      - Topic affinity: if user consistently likes "LLMs" articles, boost "LLMs" tagged articles
      - Penalty: articles from thumbs-down'd sources get -30% penalty
  - Create `src/lib/ranking/preferences.ts`:
    - `computeTopicAffinity(preferences)` — returns weighted topic scores based on user's thumbs up/down history
    - `computeSourceAffinity(sourceRatings)` — returns source weights
  - Update `GET /api/articles` to apply personalized re-ranking
  - All scoring is pure functions (immutable, testable)
- **Deliverable**: Personalized article ranking
- **Tests**: Unit tests for scoring functions with various preference scenarios
- **Branch**: `feature/3.2-reranking`
- **Dependencies**: 3.1, 1.4

### 3.3 — Source Quality Alerts
- **What**: Notify user when a source degrades
- **Tasks**:
  - Compute rolling source quality: `(initial_star_rating × 0.3) + (thumbs_up_ratio × 0.7)`
  - `GET /api/sources/alerts` — returns sources with score < 3.0
  - `src/components/sources/QualityAlert.tsx` — banner/card showing degraded sources
  - Actions: keep, pause, deprecate
  - Show alert on source dashboard and optionally on main feed
- **Deliverable**: Quality alert system
- **Tests**: Unit tests for quality computation, E2E test for alert flow
- **Branch**: `feature/3.3-quality-alerts`
- **Dependencies**: 3.2

### 3.4 — Source Discovery Review Queue (Stretch)
- **What**: Surface candidate sources for user review
- **Tasks**:
  - `src/app/discover/page.tsx` — review queue page
  - `src/components/discover/CandidateCard.tsx`:
    - Source name, platform, URL
    - Why surfaced (reason text)
    - Sample content (3–5 recent items)
    - Star rating input
    - Accept (4+) / Watchlist (3) / Reject (1–2)
  - Backend: `GET /api/sources/candidates` — returns sources found via network expansion (who seed sources interact with)
  - Initially manual: admin can add candidates; auto-discovery in future phases
- **Deliverable**: Review queue UI (candidates manually seeded for now)
- **Branch**: `feature/3.4-discovery-queue`
- **Dependencies**: 2.6

### 3.5 — Phase 3 Review
- **What**: Code review and security audit
- **Tasks**: Same as previous phase reviews
- **Branch**: `feature/3.5-phase3-review`
- **Dependencies**: 3.1–3.4

**Phase 3 Exit Criteria**:
- [ ] Feed re-ranks based on user preferences
- [ ] Topic affinity and source affinity computed
- [ ] Quality alerts surface degrading sources
- [ ] Discovery review queue available (manual candidates)
- [ ] 80%+ test coverage
- [ ] Code reviewed

---

## Phase 4 — Multi-User & Authentication

**Goal**: Multiple users with isolated preferences and personalized feeds.

### 4.1 — Supabase Auth Integration
- **What**: Email + OAuth login via Supabase Auth
- **Tasks**:
  - Enable Supabase Auth in project settings
  - Configure OAuth providers (Google, GitHub)
  - Create `src/lib/supabase/auth.ts` — sign in, sign up, sign out, session management
  - Create `src/components/auth/LoginForm.tsx`
  - Create `src/components/auth/SignUpForm.tsx`
  - Create `src/app/login/page.tsx` and `src/app/signup/page.tsx`
  - Create auth middleware (`src/middleware.ts`) — protect authenticated routes
  - Redirect unauthenticated users to login
- **Deliverable**: Working auth flow
- **Branch**: `feature/4.1-auth`
- **Dependencies**: None (can start in parallel with Phase 3)

### 4.2 — Row Level Security (RLS)
- **What**: Isolate user data at the database level
- **Tasks**:
  - Add `user_id UUID REFERENCES auth.users(id)` column to: `article_preferences`, `source_ratings`, `filter_presets`
  - Write RLS policies:
    - Users can only read/write their own preferences
    - Users can only read/write their own source ratings
    - Users can only read/write their own filter presets
    - All users can read sources and articles (shared data)
  - Update all repository functions to include `user_id` from session
  - Update all API routes to extract user from session and pass to repositories
- **Deliverable**: Per-user data isolation
- **Tests**: Integration tests verifying users can't access each other's data
- **Branch**: `feature/4.2-rls`
- **Dependencies**: 4.1

### 4.3 — Per-User Personalized Feeds
- **What**: Each user gets their own ranking based on their preferences
- **Tasks**:
  - Update re-ranking algorithm to accept `userId`
  - Fetch user-specific preferences and source ratings for scoring
  - Each user's feed is independently ranked
  - New users start with default global ranking (no preferences yet)
- **Deliverable**: Per-user personalized feeds
- **Tests**: Test that two users see different rankings for same articles
- **Branch**: `feature/4.3-personalized-feeds`
- **Dependencies**: 4.2, 3.2

### 4.4 — User Profile & Settings
- **What**: Profile page with preference management
- **Tasks**:
  - `src/app/profile/page.tsx`:
    - Display name, email, avatar
    - Topic preferences (select interested topics)
    - Notification preferences (future)
    - Export data (download preferences as JSON)
    - Delete account
  - `src/app/settings/page.tsx`:
    - Dark mode toggle
    - Default filter preset selection
    - Digest frequency preference
- **Deliverable**: Profile and settings pages
- **Branch**: `feature/4.4-profile`
- **Dependencies**: 4.1

### 4.5 — Phase 4 Security Audit
- **What**: Full security review of auth system
- **Tasks**:
  - `security-reviewer` agent on all auth code
  - Verify RLS policies are bulletproof
  - Verify session tokens are httpOnly
  - Verify CSRF protection
  - Verify no sensitive data in client-side code
  - Penetration test: try accessing another user's data
- **Deliverable**: Security-audited auth system
- **Branch**: `feature/4.5-security-audit`
- **Dependencies**: 4.1–4.4

**Phase 4 Exit Criteria**:
- [ ] Email + OAuth login working
- [ ] RLS policies enforced
- [ ] Per-user personalized feeds
- [ ] Profile and settings pages
- [ ] Security audit passed
- [ ] 80%+ test coverage

---

## Phase 5 — Production & Deployment

**Goal**: Ship to production with CI/CD, monitoring, and performance optimization.

### 5.1 — Environment & Secrets
- **What**: Configure all environments
- **Tasks**:
  - Set up Vercel project, link to GitHub repo
  - Configure Vercel environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, UPSTASH_REDIS_URL, etc.)
  - Configure GitHub Secrets for Actions (same vars + SUPABASE_SERVICE_ROLE_KEY for ingestion)
  - Create `.env.example` with all required vars documented
  - Verify no secrets in codebase (`security-scan` skill)
- **Deliverable**: All environments configured
- **Branch**: `feature/5.1-env-config`

### 5.2 — CI/CD Pipeline
- **What**: Automated test + deploy pipeline
- **Tasks**:
  - `.github/workflows/ci.yml`:
    - Trigger: push to `main`, PR to `main`
    - Steps: install → lint → type-check → unit tests → build
  - `.github/workflows/deploy.yml`:
    - Trigger: push to `main` (after CI passes)
    - Steps: deploy to Vercel via Vercel CLI
  - `.github/workflows/e2e.yml`:
    - Trigger: after deploy
    - Steps: run Playwright against deployed URL
  - Branch protection: require CI to pass before merge to `main`
- **Deliverable**: Fully automated CI/CD
- **Branch**: `feature/5.2-cicd`
- **Dependencies**: 5.1

### 5.3 — Performance Optimization
- **What**: Make it fast, especially on mobile
- **Tasks**:
  - Upstash Redis caching:
    - Cache `GET /api/articles` responses (TTL: 5 min)
    - Cache `GET /api/digest` (TTL: 1 hour)
    - Cache dedup lookups in ingestion
  - Frontend performance:
    - Verify virtualized list is efficient with 1000+ articles
    - Lazy load below-fold components
    - Optimize images (if any) with Next.js `<Image>`
    - Analyze bundle size, code-split large components
    - Verify Lighthouse mobile score > 90
  - Database:
    - Verify query plans for common queries (EXPLAIN ANALYZE)
    - Add missing indexes if needed
    - Implement article TTL (delete articles older than 90 days to stay under 50K row limit)
- **Deliverable**: Fast mobile experience, Lighthouse > 90
- **Branch**: `feature/5.3-performance`
- **Dependencies**: 5.1

### 5.4 — Monitoring & Error Tracking
- **What**: Know when things break
- **Tasks**:
  - Add Sentry (free tier) for error tracking — `@sentry/nextjs`
  - Add structured logging in API routes and ingestion scripts
  - Create health check endpoint: `GET /api/health`
  - GitHub Actions notification on ingestion failure (Slack/email webhook)
  - Supabase dashboard monitoring (check row counts, storage usage)
- **Deliverable**: Error tracking and alerting
- **Branch**: `feature/5.4-monitoring`
- **Dependencies**: 5.1

### 5.5 — Final Verification & Launch
- **What**: Full verification loop, then deploy
- **Tasks**:
  - Run `verification-loop` skill (build + types + lint + tests + security)
  - Run full E2E suite against staging
  - Verify all ingestion cron jobs are running
  - Verify data is flowing into production Supabase
  - Test on real mobile device (iPhone + Android)
  - **USER CHECKPOINT**: Demo the production site, get launch approval
  - Merge to `main`, auto-deploy to Vercel
- **Deliverable**: Live production website
- **Dependencies**: 5.1–5.4

**Phase 5 Exit Criteria**:
- [ ] CI/CD pipeline running
- [ ] Vercel deployment working
- [ ] Lighthouse mobile score > 90
- [ ] Sentry error tracking active
- [ ] Ingestion cron jobs running in production
- [ ] All E2E tests passing against production
- [ ] User has approved and launched

---

## Dependency Graph

```
Phase 0 (Research & Planning)
    │
    ▼
Phase 1.1 (Scaffolding)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 1.2 (Schema)   Phase 2.1 (Design System) ← can start in parallel
    │                  │
    ▼                  ▼
Phase 1.3 (Repo)     Phase 2.2 (Layout)
    │                  │
    ▼                  │
Phase 1.4 (API)       │
    │                  │
    ├──────────┬───────┘
    ▼          ▼
Phase 1.5    Phase 2.3–2.8 (Frontend pages)
(Ingestion)    │
    │          ▼
    ▼        Phase 2.9 (Review)
Phase 1.6      │
(Review)       │
    │          │
    └──────────┘
         │
         ▼
    Phase 3 (Personalization)  ←─── Phase 4.1 (Auth) can start in parallel
         │                              │
         ▼                              ▼
    Phase 3.5 (Review)          Phase 4.2–4.5 (Multi-user)
         │                              │
         └──────────────────────────────┘
                      │
                      ▼
               Phase 5 (Production)
```

---

## Estimated Complexity

| Phase | Complexity | Key Challenge |
|---|---|---|
| Phase 0 | LOW | Research, decisions, documentation |
| Phase 1 | HIGH | Ingestion pipeline (multiple APIs, dedup, error handling) |
| Phase 2 | HIGH | Mobile-first responsive UI, filter system, virtualized list |
| Phase 3 | MEDIUM | Ranking algorithm, preference modeling |
| Phase 4 | MEDIUM | RLS policies, auth edge cases |
| Phase 5 | LOW-MEDIUM | Optimization, CI/CD, monitoring |
