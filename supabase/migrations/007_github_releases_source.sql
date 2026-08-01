-- =============================================================================
-- 007: Repoint "GitHub Releases (tracked)" at the new dedicated fetcher
-- =============================================================================
-- This source previously shared platform='github' with "GitHub Trending",
-- which routed both to the same trending-search fetcher. Its articles were
-- identical to Trending's and got silently deduplicated away (0 rows ever
-- stored). It now has its own platform value routed to a real releases
-- fetcher (ingestion/fetchers/github_releases.py) that tracks a curated
-- watchlist of high-impact repos.

-- Both sources.platform and articles.platform enumerate allowed values via
-- a CHECK constraint (see 001_create_tables.sql) — add 'github_releases'.
ALTER TABLE sources DROP CONSTRAINT sources_platform_check;
ALTER TABLE sources ADD CONSTRAINT sources_platform_check CHECK (platform IN (
    'arxiv', 'reddit', 'hackernews', 'github', 'github_releases', 'huggingface',
    'youtube', 'x', 'linkedin', 'lobsters', 'discord',
    'blog', 'newsletter', 'pypi', 'semantic_scholar',
    'papers_with_code', 'openreview', 'ollama', 'other'
));

ALTER TABLE articles DROP CONSTRAINT articles_platform_check;
ALTER TABLE articles ADD CONSTRAINT articles_platform_check CHECK (platform IN (
    'arxiv', 'reddit', 'hackernews', 'github', 'github_releases', 'huggingface',
    'youtube', 'x', 'linkedin', 'lobsters', 'discord',
    'blog', 'newsletter', 'pypi', 'semantic_scholar',
    'papers_with_code', 'openreview', 'ollama', 'other'
));

UPDATE sources
SET platform = 'github_releases',
    status = 'active',
    notes = 'Tracks new releases from a curated watchlist of high-impact open-source AI/ML repos (llama.cpp, vLLM, transformers, LangChain, Ollama, etc.)'
WHERE name = 'GitHub Releases (tracked)';
