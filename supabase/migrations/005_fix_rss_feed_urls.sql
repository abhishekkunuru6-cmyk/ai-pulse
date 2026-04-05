-- =============================================================================
-- 005: Fix RSS feed URLs — use actual feed endpoints instead of homepage URLs
-- =============================================================================

-- NEWS & BLOGS — fix to actual RSS/Atom feed URLs
UPDATE sources SET url = 'https://www.deeplearning.ai/the-batch/feed/'
  WHERE name = 'The Batch (Andrew Ng)';

UPDATE sources SET url = 'https://importai.substack.com/feed'
  WHERE name = 'Import AI (Jack Clark)';

UPDATE sources SET url = 'https://thegradient.pub/rss/'
  WHERE name = 'The Gradient';

UPDATE sources SET url = 'https://magazine.sebastianraschka.com/feed'
  WHERE name = 'Ahead of AI (Sebastian Raschka)';

UPDATE sources SET url = 'https://simonwillison.net/atom/everything/'
  WHERE name LIKE 'Simon Willison%';

UPDATE sources SET url = 'https://lilianweng.github.io/index.xml'
  WHERE name LIKE 'Lil%Log%';

UPDATE sources SET url = 'https://jalammar.github.io/feed.xml'
  WHERE name = 'Jay Alammar';

UPDATE sources SET url = 'https://huyenchip.com/feed.xml'
  WHERE name LIKE 'Chip Huyen%';

UPDATE sources SET url = 'https://www.technologyreview.com/feed/'
  WHERE name = 'MIT Technology Review -- AI';

UPDATE sources SET url = 'https://venturebeat.com/feed/'
  WHERE name = 'VentureBeat AI';

UPDATE sources SET url = 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'
  WHERE name = 'The Verge -- AI';

UPDATE sources SET url = 'https://feeds.arstechnica.com/arstechnica/technology-lab'
  WHERE name = 'Ars Technica -- AI';

UPDATE sources SET url = 'https://techcrunch.com/feed/'
  WHERE name = 'TechCrunch -- AI';

UPDATE sources SET url = 'https://www.latent.space/feed'
  WHERE name = 'Latent Space Podcast';

-- COMPANIES — switch blog sources that have RSS feeds from scrape to rss type
UPDATE sources SET url = 'https://openai.com/blog/rss.xml'
  WHERE name = 'OpenAI Blog';

UPDATE sources SET url = 'https://www.microsoft.com/en-us/research/feed/'
  WHERE name = 'Microsoft Research Blog';

UPDATE sources SET url = 'https://blogs.nvidia.com/feed/'
  WHERE name = 'NVIDIA AI Blog';

UPDATE sources SET url = 'https://machinelearning.apple.com/rss.xml'
  WHERE name = 'Apple Machine Learning';

-- SECONDARY SOURCES — fix to actual feed URLs
UPDATE sources SET url = 'https://lastweekin.ai/feed'
  WHERE name = 'Last Week in AI Newsletter';

UPDATE sources SET url = 'https://tldr.tech/ai/rss'
  WHERE name = 'AI News Roundup (TLDR)';

UPDATE sources SET url = 'https://dblalock.substack.com/feed'
  WHERE name = 'Davis Summarizes Papers';

UPDATE sources SET url = 'https://www.interconnects.ai/feed'
  WHERE name LIKE 'Interconnects%';

-- PODCASTS — fix to actual RSS feed URLs
UPDATE sources SET url = 'https://lexfridman.com/feed/podcast/'
  WHERE name = 'Lex Fridman Podcast';

-- Convert company blog sources that now have RSS URLs from scrape → rss type
UPDATE sources SET type = 'rss'
  WHERE name IN ('OpenAI Blog', 'Microsoft Research Blog', 'NVIDIA AI Blog', 'Apple Machine Learning')
  AND type IN ('scrape', 'api');

-- Pause sources that have no fetcher and no valid RSS feed (scrape-only, no scraper implemented)
-- These can be reactivated once a scraper fetcher is built
UPDATE sources SET status = 'paused'
  WHERE type = 'scrape'
  AND platform IN ('blog', 'other', 'ollama', 'x')
  AND status = 'active';

-- Pause API-only sources that have no fetcher implemented yet
UPDATE sources SET status = 'paused'
  WHERE type = 'api'
  AND platform IN ('arxiv', 'semantic_scholar', 'papers_with_code', 'openreview',
                   'huggingface', 'github', 'lobsters')
  AND status = 'active';

-- Pause YouTube API sources (no YouTube fetcher yet; only RSS-type YouTube works)
UPDATE sources SET status = 'paused'
  WHERE type = 'api'
  AND platform = 'youtube'
  AND status = 'active';

-- Pause PyPI (the rss URL https://pypi.org is not a valid feed)
UPDATE sources SET status = 'paused'
  WHERE name LIKE 'PyPI%';
