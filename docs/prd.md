# AI Pulse -- Product Requirements Document

> **Last updated:** 2026-03-15
> **Status:** Phase 0 (Research & Planning)
> **Version:** 1.0

---

## 1. Product Overview

**Product Name:** AI Pulse
**Tagline:** "Stay on the pulse of AI"

AI Pulse is a personal AI news aggregator that consolidates developments from 60+ sources across research papers, social platforms, code repositories, blogs, newsletters, benchmarks, and podcasts into a single, mobile-first feed. It follows the core principle of **Discover, Rank, Link -- never store content**: the system discovers high-quality AI content, ranks it by relevance and user preference, and links directly to the original source. No article body, images, or media are ever stored -- only metadata (title, URL, source, timestamp, summary snippet, engagement metrics). This keeps the system lightweight, copyright-friendly, and ensures users always read the freshest version at the source.

**Target User:** AI/ML practitioners -- researchers, engineers, and enthusiasts -- who want a single feed for all AI developments without checking 5-10 different platforms daily.

**Core Principle:** Discover, Rank, Link -- never store content.

---

## 2. User Stories

### Phase 1 -- Backend

---

#### US-1.1: Database Schema

**As a** developer, **I want** a Supabase database with all tables **so I can** store source and article metadata.

**Acceptance Criteria:**
- Supabase Postgres database is provisioned on the free tier
- `sources` table exists with columns: id, name, url, category, type, status, platform, added_on, last_fetched, fetch_frequency, reliability_score, notes, created_at, updated_at
- `articles` table exists with columns: id, title, url, source_id (FK), published_at, fetched_at, summary_snippet, content_type, topic_tags, platform, engagement_score, engagement_metrics, recommendation_reason, is_read, is_saved, created_at
- `article_preferences` table exists with columns: id, article_id (FK), rating (up/down), created_at; unique constraint on article_id
- `source_ratings` table exists with columns: id, source_id (FK), star_rating (1-5), created_at; unique constraint on source_id
- `filter_presets` table exists with columns: id, name, filter_config (JSONB), created_at
- All CHECK constraints are enforced (category, type, status, platform, content_type, rating, star_rating range)
- Indexes exist on: articles(source_id), articles(published_at DESC), articles(content_type), articles(platform), articles(is_read), articles(is_saved), articles(topic_tags) using GIN, sources(status), sources(category)
- 60+ initial sources are seeded into the sources table
- An `updated_at` trigger auto-updates the sources table on row changes

**Priority:** P0
**Phase:** 1

---

#### US-1.2: Article API Routes

**As a** developer, **I want** API routes for articles with filtering and pagination **so the** frontend can fetch data.

**Acceptance Criteria:**
- `GET /api/articles` returns paginated articles with cursor-based pagination (default 20, max 50 per page)
- Supports filtering by: content_type, platform, time_range (today, week, month, all, custom ISO range), quality (top_rated, all_rated, unrated), topic, engagement (trending, most_liked, controversial, under_the_radar), read_status (unread, read, saved)
- `GET /api/articles/[id]` returns a single article by ID
- `GET /api/articles/search?q=` performs full-text search on title and summary_snippet
- `POST /api/articles/[id]/read` marks an article as read
- `POST /api/articles/[id]/save` toggles the saved/bookmarked state
- `POST /api/articles/[id]/rate` accepts `{ "rating": "up" | "down" }` and stores the preference
- All routes validate input with Zod schemas
- All routes return the standard envelope: `{ success, data, error, meta }`
- Invalid input returns 400 with descriptive error message
- Non-existent resources return 404
- `GET /api/digest` returns top 10 articles for a given period (daily or weekly)
- `GET /api/stats` returns dashboard statistics (total articles, total sources, articles today, sources by status/category, read rate)
- `GET /api/health` returns service health status with database and cache connectivity

**Priority:** P0
**Phase:** 1

---

#### US-1.3: Source API Routes

**As a** developer, **I want** API routes for source CRUD **so** sources can be managed.

**Acceptance Criteria:**
- `GET /api/sources` returns all sources with optional filters (category, status, platform)
- `POST /api/sources` creates a new source with required fields (name, url, category, type, platform, fetch_frequency) and optional fields (notes)
- `PATCH /api/sources/[id]` updates source fields (partial update)
- `PATCH /api/sources/[id]/status` changes source status (active, paused, deprecated)
- `GET /api/sources/[id]/rate` returns the current star rating for a source
- `POST /api/sources/[id]/rate` sets or updates the star rating (1-5)
- `GET /api/filter-presets` lists all saved filter presets
- `POST /api/filter-presets` creates a new named filter preset with filter_config JSONB
- `DELETE /api/filter-presets/[id]` deletes a filter preset
- All routes validate input with Zod schemas
- All routes return the standard envelope format
- Duplicate source URLs are rejected with 409 Conflict

**Priority:** P0
**Phase:** 1

---

#### US-1.4: Ingestion Scripts

**As a** developer, **I want** Python ingestion scripts that fetch from HN, Reddit, and RSS **so** articles flow into the database automatically.

**Acceptance Criteria:**
- A `BaseFetcher` abstract class defines the interface: `fetch(source) -> list[RawArticle]`
- `hackernews.py` fetches AI-tagged posts from HN Algolia API (free, no auth)
- `reddit.py` fetches top posts from r/MachineLearning, r/LocalLLaMA, r/artificial using Reddit OAuth API
- `rss.py` generically fetches from any RSS/Atom feed (covers blogs, newsletters, company blogs, and secondary aggregator sources for X/LinkedIn content)
- `normalizer.py` converts source-specific data into a uniform `ArticleMetadata` format (title, url, source_id, published_at, summary_snippet, content_type, platform, engagement_metrics)
- `deduplicator.py` performs URL exact match and fuzzy title matching (threshold 90%) using Redis
- `tagger.py` assigns topic_tags based on keywords, subreddit names, ArXiv categories, and GitHub repo topics
- `scorer.py` computes initial engagement_score as: source_reliability * recency_decay * normalized_engagement
- `run.py` orchestrates the full pipeline: load active sources, fetch, normalize, deduplicate, tag, score, batch upsert to Supabase
- All scripts use environment variables for secrets (no hardcoded credentials)
- Each fetcher handles API errors gracefully (retries, logging, skipping on failure without crashing the pipeline)
- Pipeline logs the number of articles fetched, deduplicated, and stored per run

**Priority:** P0
**Phase:** 1

---

#### US-1.5: Cron Workflows

**As a** developer, **I want** GitHub Actions cron workflows **so** ingestion runs on schedule.

**Acceptance Criteria:**
- `ingest-wave1.yml` runs every 4 hours (`0 */4 * * *`) for HN, ArXiv, RSS feeds, and Lobsters
- `ingest-wave2.yml` runs every 6 hours (`0 */6 * * *`) for HuggingFace, Papers With Code, Semantic Scholar, and PyPI
- `ingest-wave3.yml` runs every 6 hours (`0 */6 * * *`) for GitHub, Reddit, and YouTube
- All workflows support `workflow_dispatch` for manual triggering
- All workflows use GitHub Secrets for API keys and database credentials
- Failed workflow runs are detectable via GitHub Actions UI
- Workflows stay within GitHub Actions free tier limits (2000 min/month for private repos)
- Regular cron runs keep the Supabase free tier project active (prevents 1-week inactivity pause)

**Priority:** P0
**Phase:** 1

---

### Phase 1.5 -- UI Wireframes (Bridge to Phase 2)

---

#### US-1.6: UI Wireframes & Mockups

**As a** user, **I want** to review rough wireframes of all key pages before frontend development begins **so I can** approve the design direction early.

**Acceptance Criteria:**
- HTML/Tailwind wireframes (clickable, no backend) for: article feed, source dashboard, digest, search, filter panel, saved articles
- Mobile and desktop viewport versions for each page
- Wireframes deployed to a Vercel preview URL for review
- User approval required before Phase 2 implementation begins

**Priority:** P0
**Phase:** 1 (end of phase, before Phase 2)

---

### Phase 2 -- Frontend

---

#### US-2.1: Mobile-First Article Feed

**As a** user, **I want** a mobile-first article feed **so I can** browse AI news on my phone.

**Acceptance Criteria:**
- Home page displays a scrollable feed of articles ranked by score
- Each article card shows: title, source name, platform icon, relative time ("2h ago"), summary snippet (2 lines max), topic tags as badges, and recommendation reason
- Feed uses virtualized rendering (`@tanstack/react-virtual`) for performance with 1000+ articles
- Infinite scroll loads the next page automatically via cursor-based pagination
- Loading skeletons display while data is fetching
- Empty state shows "No articles found" with suggestion to adjust filters
- Mobile layout is the default; tablet and desktop layouts layer on top via `sm:`, `md:`, `lg:` breakpoints
- Touch interactions are smooth (no jank during scroll)

**Priority:** P0
**Phase:** 2

---

#### US-2.2: Open Original URL

**As a** user, **I want** to tap an article to open the original URL **so I** always read at the source.

**Acceptance Criteria:**
- Tapping the article title or "Read" link opens the original URL in a new browser tab
- The article is automatically marked as read when the link is tapped
- Read articles are visually distinguished (muted title or opacity change)
- No content is displayed within AI Pulse -- the user always leaves the site to read

**Priority:** P0
**Phase:** 2

---

#### US-2.3: Keyword Search

**As a** user, **I want** to search articles by keyword **so I can** find specific topics.

**Acceptance Criteria:**
- Search bar is accessible from the header (desktop) or via icon tap (mobile, full-width overlay)
- Search input debounces at 300ms to avoid excessive API calls
- Search queries the `GET /api/articles/search?q=` endpoint (full-text on title + summary)
- Results display in the same article feed format
- Clear button resets search and returns to the default feed
- Empty search results show "No results for [query]"

**Priority:** P0
**Phase:** 2

---

#### US-2.4: Filter by Content Type

**As a** user, **I want** to filter by content type (papers, blogs, news, social, code, newsletters, videos, benchmarks) **so I** see only what I want.

**Acceptance Criteria:**
- Content type filter options: paper, blog, news, social, code, newsletter, video, podcast, benchmark
- Filters are displayed as toggle chips in a horizontal scrollable bar (mobile) or sidebar panel (desktop)
- Multiple content types can be selected simultaneously
- Active filter chips are visually highlighted
- Feed updates immediately when a filter is toggled
- URL query parameters reflect active filters (e.g., `?content_type=paper,blog`)

**Priority:** P0
**Phase:** 2

---

#### US-2.5: Filter by Source Platform

**As a** user, **I want** to filter by source platform (Reddit, HN, GitHub, ArXiv, etc.) **so I can** focus on one platform.

**Acceptance Criteria:**
- Platform filter options match the `platform` enum: arxiv, reddit, hackernews, github, huggingface, youtube, blog, newsletter, and others
- Single or multiple platforms can be selected
- Feed updates immediately when platforms are toggled
- URL query parameters reflect active platform filters

**Priority:** P0
**Phase:** 2

---

#### US-2.6: Filter by Time Range

**As a** user, **I want** to filter by time range (today, this week, this month, custom) **so I** see recent content.

**Acceptance Criteria:**
- Quick options: Today (last 24h), This Week (last 7 days), This Month (last 30 days), All Time
- Custom date range picker allows selecting start and end dates
- Feed updates immediately when time range changes
- Default is "All Time" (no time filter applied)

**Priority:** P0
**Phase:** 2

---

#### US-2.7: Filter by Quality Rating

**As a** user, **I want** to filter by quality rating **so I** only see top-rated sources.

**Acceptance Criteria:**
- Quality filter options: Top Rated (sources rated 4-5 stars), All Rated (any rated source), Unrated (new/unrated sources)
- Feed shows only articles from sources matching the quality filter
- Default is "All" (no quality filter)

**Priority:** P1
**Phase:** 2

---

#### US-2.8: Filter by Topic

**As a** user, **I want** to filter by topic (LLMs, CV, RL, safety, MLOps, etc.) **so I can** focus on my interests.

**Acceptance Criteria:**
- Topic filter options: LLMs, Computer Vision, Reinforcement Learning, AI Safety & Alignment, MLOps & Infrastructure, Open Source Models, Multimodal, Agents & Tool Use, Hardware, Startups & Products
- Multiple topics can be selected simultaneously
- Filter matches against the `topic_tags` array on each article
- Feed updates immediately when topics are toggled

**Priority:** P0
**Phase:** 2

---

#### US-2.9: Filter by Engagement

**As a** user, **I want** to filter by engagement (trending, most liked, under the radar) **so I** discover content differently.

**Acceptance Criteria:**
- Engagement filter options: Trending (high engagement in last 24-48h), Most Liked (highest thumbs-up historically), Controversial (high engagement but mixed sentiment), Under the Radar (low engagement but from high-quality sources)
- Only one engagement filter can be active at a time
- Feed re-sorts based on the selected engagement mode

**Priority:** P1
**Phase:** 2

---

#### US-2.10: Filter by Read Status

**As a** user, **I want** to filter by read status (unread, read, saved) **so I** track what I've consumed.

**Acceptance Criteria:**
- Read status filter options: Unread, Read, Saved
- Default feed shows all articles regardless of read status
- Selecting "Unread" hides articles the user has already opened
- Selecting "Saved" shows only bookmarked articles

**Priority:** P1
**Phase:** 2

---

#### US-2.11: Combine Multiple Filters

**As a** user, **I want** to combine multiple filters **so I can** create precise views.

**Acceptance Criteria:**
- All 7 filter dimensions (content type, platform, time range, quality, topic, engagement, read status) can be combined simultaneously
- Example: "Research Papers" + "This Week" + "Top Rated" + "LLMs" shows only 4-5 star source papers about LLMs from the last 7 days
- Active filter count badge shows how many filters are applied
- "Clear All" button resets all filters to defaults
- URL query parameters encode the full filter state for shareable/bookmarkable URLs

**Priority:** P0
**Phase:** 2

---

#### US-2.12: Save Filter Presets

**As a** user, **I want** to save filter presets (e.g., "Morning Catch-up") **so I can** reuse my favorite filter combos.

**Acceptance Criteria:**
- "Save current filters" button captures the active filter state and prompts for a name
- Saved presets appear as quick-access chips above the filter bar
- Tapping a preset chip applies all its filters at once
- Presets can be renamed and deleted
- Presets are stored via the `POST /api/filter-presets` endpoint
- At least 10 presets can be saved

**Priority:** P1
**Phase:** 2

---

#### US-2.13: Source Management Dashboard

**As a** user, **I want** a source management dashboard **so I can** view, add, edit, pause, and deprecate sources.

**Acceptance Criteria:**
- `/sources` page lists all sources with: name, URL, category, platform, status, last fetched time, reliability score
- Sources can be filtered by category, status, and platform
- Sources can be sorted by name, reliability score, or last fetched time
- Quick action buttons allow: pause, activate, deprecate for each source
- "Add Source" form accepts URL, category, type, platform, fetch frequency, and notes
- Source detail view shows: metadata, recent articles from that source, star rating, and performance stats (articles fetched, thumbs up/down ratio)
- Visual indicator highlights sources that need attention (stale or low-quality)
- Mobile: sources displayed as cards with swipe actions
- Desktop: table layout with inline actions

**Priority:** P0
**Phase:** 2

---

#### US-2.14: Daily Digest

**As a** user, **I want** a daily digest page ("Top 10 to read today") **so I** get a quick summary.

**Acceptance Criteria:**
- `/digest` page shows the top 10 articles for today, ranked by score
- Each digest item shows: rank number (1-10), title, source name, one-line summary, and "Read" link
- Option to switch between daily and weekly digest
- Digest is computed server-side via `GET /api/digest` (cached for 1 hour)
- Mobile-optimized: simple numbered list or swipeable cards

**Priority:** P1
**Phase:** 2

---

#### US-2.15: Save Articles for Later

**As a** user, **I want** to save articles for later **so I can** read them when I have time.

**Acceptance Criteria:**
- Each article card has a bookmark/save button
- Tapping save toggles the `is_saved` state via `POST /api/articles/[id]/save`
- Saved articles are accessible from `/saved` page
- Save state persists across sessions
- Saved articles show a visual indicator (filled bookmark icon)

**Priority:** P0
**Phase:** 2

---

#### US-2.16: Read History

**As a** user, **I want** to see my read history **so I** know what I've already consumed.

**Acceptance Criteria:**
- `/history` page lists all articles the user has opened, sorted by most recently read
- Read history reuses the article feed component with `is_read=true` filter
- Unread count badge is visible in the navigation

**Priority:** P1
**Phase:** 2

---

#### US-2.17: Recommendation Reason

**As a** user, **I want** each article to show WHY it's being recommended **so I** understand the ranking.

**Acceptance Criteria:**
- Each article card displays a `recommendation_reason` text (e.g., "Trending on r/MachineLearning", "From a source you rated 5 stars", "Related to topics you liked")
- Recommendation reason is computed during ingestion and scoring
- The text is concise (one sentence max)
- Displayed in a muted/secondary style below the article summary

**Priority:** P1
**Phase:** 2

---

### Phase 3 -- Personalization

---

#### US-3.1: Thumbs Up/Down

**As a** user, **I want** to thumbs up/down articles **so the** feed learns my preferences.

**Acceptance Criteria:**
- Each article card has thumbs up and thumbs down buttons
- Tapping a thumb sends a rating via `POST /api/articles/[id]/rate`
- Active thumb is visually highlighted (filled icon, color change)
- Tapping the same thumb again removes the rating
- Undo capability within 5 seconds of rating (toast notification with "Undo" action)
- Animated thumb icons provide tactile feedback (bounce on tap)

**Priority:** P0
**Phase:** 3

---

#### US-3.2: Source Star Rating

**As a** user, **I want** to rate sources 1-5 stars **so I** control source quality.

**Acceptance Criteria:**
- Source detail page and source list show a star rating widget (1-5 stars)
- Tapping a star sets the rating via `POST /api/sources/[id]/rate`
- Current rating is displayed and persisted
- Only sources rated 4+ stars are considered "top rated" in quality filters
- Toast notification confirms the rating: "Source rated [N] stars"

**Priority:** P0
**Phase:** 3

---

#### US-3.3: Preference-Based Re-Ranking

**As a** user, **I want** the feed to re-rank based on my preferences **so it** gets smarter over time.

**Acceptance Criteria:**
- Article ranking score incorporates user feedback: `base_score * source_affinity * topic_affinity`
- Articles from thumbs-up'd sources receive a +20% score boost
- Articles from thumbs-down'd sources receive a -30% score penalty
- Topic affinity is computed from the user's rating history (topics frequently thumbs-up'd get boosted)
- New articles from unrated sources maintain their base score (no penalty for being new)
- Scoring functions are pure (immutable inputs, no side effects) and independently testable
- Feed visibly changes after the user has rated 10+ articles

**Priority:** P0
**Phase:** 3

---

#### US-3.4: Source Quality Alerts

**As a** user, **I want** quality alerts when a source degrades **so I can** pause or remove it.

**Acceptance Criteria:**
- Rolling source quality is computed as: `(initial_star_rating * 0.3) + (thumbs_up_ratio * 0.7)`
- Sources with rolling quality below 3.0 are flagged
- `GET /api/sources/alerts` returns flagged sources
- A quality alert banner/card appears on the source dashboard
- Alert shows: source name, current quality score, recent thumbs up/down ratio
- Actions available: keep (dismiss alert), pause, deprecate
- Every 30 days, a summary of lowest-performing active sources is shown for batch review

**Priority:** P1
**Phase:** 3

---

#### US-3.5: Source Discovery Review Queue

**As a** user, **I want** a source discovery review queue **so I can** approve new sources before they enter my feed.

**Acceptance Criteria:**
- `/discover` page shows candidate sources in a review queue
- Each candidate card shows: name, platform, URL, reason for surfacing, and 3-5 sample articles
- User can rate each candidate 1-5 stars
- Only sources rated 4+ stars are added to the active feed
- Sources rated 3 stars go to a watchlist (re-surfaced in 2 weeks with fresh samples)
- Sources rated 1-2 stars are rejected (not surfaced again)
- Initially, candidates are manually seeded by the user; auto-discovery is a future enhancement

**Priority:** P2
**Phase:** 3

---

#### US-3.6: Secondary Source Discovery (X/LinkedIn via Aggregators)

**As a** user, **I want** the system to discover high-quality X/Twitter and LinkedIn content via secondary aggregator sources **so I** get coverage of those platforms without paying for their APIs.

**Acceptance Criteria:**
- Secondary aggregator sources are tracked in the `sources` table with `type: 'rss'` or `type: 'scrape'` and a `discovery_type: 'secondary'` tag in notes
- Secondary source categories include:
  - Thread unrollers (ThreadReaderApp) for popular AI Twitter threads
  - Newsletter digests that curate top AI tweets/LinkedIn posts weekly (e.g., "Last Week in AI", "The Batch")
  - Reddit threads and blog posts ranking top AI accounts on X/LinkedIn (scraped periodically)
  - Substack/blog authors who cross-post their LinkedIn content
  - Curated Twitter list RSS exports (via Feedbin, Inoreader, or similar)
- Articles fetched from secondary sources include the original X/LinkedIn URL where possible (extracted from the aggregator content)
- Discovered accounts/profiles are surfaced in the Source Discovery Review Queue (US-3.5) for user rating
- Only accounts rated 4+ stars have their content tracked going forward
- At least 10 secondary aggregator sources are seeded in Phase 1's `sources.json`

**Priority:** P1
**Phase:** 3 (ingestion config seeded in Phase 1)

---

### Phase 4 -- Multi-User

---

#### US-4.1: Sign Up and Log In

**As a** user, **I want** to sign up and log in **so** my preferences are saved.

**Acceptance Criteria:**
- Sign up page accepts email and password
- OAuth login supported via Google and GitHub (Supabase Auth providers)
- Login page authenticates and redirects to the feed
- Sign out button is accessible from the header/profile area
- Session persists across browser restarts (httpOnly cookies)
- Unauthenticated users are redirected to the login page
- Password reset flow is available via email

**Priority:** P0
**Phase:** 4

---

#### US-4.2: User Data Isolation

**As a** user, **I want** my preferences isolated from other users **so** my feed is personalized to me.

**Acceptance Criteria:**
- `article_preferences`, `source_ratings`, and `filter_presets` tables gain a `user_id` column referencing `auth.users(id)`
- Row Level Security (RLS) policies enforce: users can only read/write their own preferences, ratings, and presets
- Sources and articles remain shared (readable by all users)
- API routes extract the authenticated user from the session and pass `user_id` to repository functions
- Integration tests verify that User A cannot access User B's preferences

**Priority:** P0
**Phase:** 4

---

#### US-4.3: Profile Page

**As a** user, **I want** a profile page **so I can** manage my account and export my data.

**Acceptance Criteria:**
- `/profile` page displays: name, email, avatar
- User can select interested topics for initial feed tuning
- User can toggle dark mode
- User can select a default filter preset
- "Export Data" button downloads all user preferences, ratings, and presets as JSON
- "Delete Account" button removes the user and all associated data after confirmation
- `/settings` page offers digest frequency preference and notification preferences (future)

**Priority:** P1
**Phase:** 4

---

### Phase 5 -- Production

---

#### US-5.1: CI/CD Pipeline

**As a** developer, **I want** CI/CD **so** code is automatically tested and deployed.

**Acceptance Criteria:**
- `ci.yml` runs on every push and PR to `main`: install, lint (ESLint + Ruff), type check (tsc --noEmit), unit tests (Vitest + pytest), coverage check (80% threshold)
- `deploy.yml` triggers on push to `main` after CI passes: deploys to Vercel production
- `e2e.yml` runs Playwright tests against the deployed URL after deployment
- Branch protection requires CI to pass before merging to `main`
- All environment variables are configured via Vercel env vars and GitHub Secrets
- No secrets exist in the codebase (verified by security scan)

**Priority:** P0
**Phase:** 5

---

#### US-5.2: Error Tracking

**As a** developer, **I want** error tracking **so I** know when things break.

**Acceptance Criteria:**
- Sentry (free tier) is integrated via `@sentry/nextjs`
- All unhandled exceptions in API routes and frontend are captured
- Structured logging is present in all API routes and ingestion scripts
- GitHub Actions sends a notification on ingestion workflow failure
- `GET /api/health` endpoint reports database and cache connectivity status

**Priority:** P1
**Phase:** 5

---

#### US-5.3: Mobile Performance

**As a** user, **I want** the site to load fast on mobile (Lighthouse > 90) **so I** have a smooth experience.

**Acceptance Criteria:**
- Lighthouse mobile Performance score exceeds 90
- Lighthouse mobile Accessibility score exceeds 90
- Article feed remains smooth when scrolling through 1000+ virtualized items
- Below-fold components are lazy loaded
- Upstash Redis caches API responses: article feed (5 min TTL), digest (1 hour TTL), stats (10 min TTL)
- Bundle size is analyzed; large components are code-split
- Articles older than 90 days are archived/deleted to stay under the 50K Supabase row limit

**Priority:** P0
**Phase:** 5

---

## 3. Out of Scope (Per Phase)

### Phase 1 -- Backend
- No frontend UI (API-only, tested via integration tests and API clients)
- No authentication or user accounts
- No personalized ranking (base scoring only using source reliability, recency, engagement)
- No X/Twitter API integration ($100/mo cost -- use curated RSS alternatives)
- No LinkedIn API integration (partner-only access)
- No LLM-based relevance scoring (keyword-based tagging only)
- No real-time push notifications or WebSocket connections
- No Discord community monitoring
- No web scraping for company blogs (RSS and API fetchers only in initial wave)

### Phase 2 -- Frontend
- No authentication (single-user, no login required)
- No personalized re-ranking based on user feedback (base scoring only)
- No source discovery review queue
- No PWA or offline support
- No email digest delivery
- No mobile native app (responsive web only)
- No vector embeddings or semantic search
- No LLM-powered content summarization

### Phase 3 -- Personalization
- No multi-user support (all preferences belong to a single user)
- No vector embeddings or semantic search (stretch goal, not committed)
- No LLM-based content summarization or analysis
- No auto-discovery of candidate sources (manual candidates only)
- No collaborative filtering across users
- No notification system for quality alerts (in-app only)

### Phase 4 -- Multi-User
- No admin panel for managing all users
- No team or organization features
- No shared filter presets between users
- No social features (following other users, shared feeds, comments)
- No paid tier or premium features
- No RBAC beyond basic authenticated/unauthenticated

### Phase 5 -- Production
- No custom domain (uses `.vercel.app` subdomain)
- No uptime monitoring service beyond Sentry + health endpoint
- No A/B testing framework
- No analytics dashboard beyond `GET /api/stats`
- No internationalization (English only)
- No mobile native app

---

## 4. Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| **Daily active usage** | Open the app at least once per day | Track daily visits via read/save/rate API calls |
| **Articles ingested per day** | 50-200 new articles/day across all sources | Count new rows in `articles` table per day via `GET /api/stats` |
| **Feed relevance score** | > 70% thumbs up (of all rated articles) | Ratio of `up` to total ratings in `article_preferences` |
| **Source quality** | Average star rating > 3.5 across active sources | Mean of `star_rating` in `source_ratings` for active sources |
| **Mobile Lighthouse score** | > 90 for Performance and Accessibility | Lighthouse CI or manual audit |
| **Ingestion success rate** | > 95% of scheduled runs complete without error | GitHub Actions workflow success rate |
| **Time spent on site** | > 5 minutes per session | Inferred from time between first and last API call per session |
| **Saved articles per week** | > 10 articles saved per week | Count of `is_saved=true` toggles per week |
| **Filter usage** | > 50% of sessions use at least one filter | Track filter query parameters in article API calls |

---

## 5. Technical Constraints

| Constraint | Limit | Impact |
|---|---|---|
| **$0/month budget** | All services must be free tier | No paid APIs, no custom domains, no premium features |
| **Supabase free tier** | 500MB storage, 50K rows, pauses after 1 week inactivity | Must implement article TTL (archive after 90 days), aggressive dedup; cron jobs keep project alive |
| **Upstash Redis free tier** | 10K commands/day, 256MB storage | Cache only hot paths (feed, digest, dedup); avoid caching low-traffic endpoints |
| **GitHub Actions free tier** | 2000 min/month (private repo), unlimited (public) | Stagger ingestion waves to distribute usage; keep each run under 5 minutes |
| **Vercel free tier** | 100GB bandwidth, serverless functions, no commercial use | Sufficient for personal use; monitor bandwidth if traffic grows |
| **No X/Twitter API** | Costs $100/month minimum | Use curated RSS alternatives, Nitter mirrors, or manual curation for X content |
| **No LinkedIn API** | Partner-only access, no public API for content | Skip LinkedIn ingestion; manual curation only |
| **No full article storage** | Core principle: metadata only | Summary snippets limited to 2-3 sentences; user always reads at source URL |

---

## 6. Dependencies & Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Supabase free tier row limit (50K)** | HIGH | HIGH | Implement 90-day article TTL with automated cleanup; aggressive deduplication; monitor row count via `GET /api/stats` |
| **Supabase free tier pauses after 1 week inactivity** | HIGH | MEDIUM | GitHub Actions cron jobs write to the database every 4 hours, keeping the project alive; add a health check write if ingestion finds no new articles |
| **GitHub Actions cron unreliable timing** | MEDIUM | MEDIUM | Design for eventual consistency, not real-time; cron may drift by minutes; use `workflow_dispatch` for manual catch-up runs |
| **Reddit/GitHub API rate limits** | MEDIUM | MEDIUM | Respect rate limits with backoff; cache API responses; stagger fetches across waves; use authenticated requests for higher limits |
| **Upstash 10K commands/day limit** | MEDIUM | LOW | Cache only high-traffic paths (article feed, dedup lookups); batch Redis operations; monitor daily command count |
| **RSS feeds disappearing or changing format** | LOW | MEDIUM | Graceful per-source failure handling; staleness detection flags sources with no new content in 14+ days; log and alert on parse errors |
| **External API breaking changes** | MEDIUM | LOW | Each fetcher is isolated; a broken fetcher does not crash the pipeline; version-pin API endpoints where possible |
| **Supabase free tier performance under load** | LOW | LOW | Single-user MVP has minimal load; use Redis caching to reduce database queries; optimize with indexes |
| **Vercel cold starts on serverless functions** | LOW | MEDIUM | Keep API route handlers lightweight; use edge runtime where possible; Redis caching reduces cold-start impact |

---

## 7. Timeline

| Phase | Name | Status | Key Milestone | Dependencies |
|---|---|---|---|---|
| **Phase 0** | Research & Planning | COMPLETE | Architecture doc, competitor analysis, implementation plan, and PRD completed | None |
| **Phase 1** | Foundation (Backend Core) | NEXT | Database schema deployed, API routes working, ingestion pipeline running for HN + RSS + Reddit, data flowing into Supabase | Phase 0 |
| **Phase 2** | Frontend (Mobile-First UI) | Planned | Mobile-first article feed, search, 7-dimension filter system, source dashboard, digest, saved/history pages, all E2E tests passing | Phase 1 (API routes required) |
| **Phase 3** | Personalization & Feedback | Planned | Thumbs up/down feedback loop, source star ratings, preference-based re-ranking, quality alerts, source discovery review queue | Phase 2 (feed UI required) |
| **Phase 4** | Multi-User & Authentication | Planned | Supabase Auth (email + OAuth), Row Level Security, per-user personalized feeds, profile and settings pages | Phase 3 (can start auth in parallel) |
| **Phase 5** | Production & Deployment | Planned | CI/CD pipeline, Sentry error tracking, Lighthouse > 90, deployed to Vercel production | Phase 4 |

**Parallelization notes:**
- Phase 2.1 (Design System) can start in parallel with Phase 1.2 (Database Schema)
- Phase 4.1 (Auth) can start in parallel with Phase 3
- Within each phase, sub-phases follow the dependency graph documented in the implementation plan (`docs/implementation-plan.md`)
