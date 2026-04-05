-- =============================================================================
-- 001: Create all tables for AI Pulse
-- =============================================================================

-- SOURCES
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

-- ARTICLES
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

-- ARTICLE PREFERENCES (thumbs up / thumbs down)
CREATE TABLE article_preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    rating      TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (article_id)
);

-- SOURCE RATINGS (1-5 stars)
CREATE TABLE source_ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    star_rating INTEGER NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_id)
);

-- FILTER PRESETS
CREATE TABLE filter_presets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    filter_config   JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
