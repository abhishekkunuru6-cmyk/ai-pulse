-- Add personalized relevance score column to articles
-- This score (0-100) is computed by LLM from user preferences (likes/dislikes)
-- NULL means not yet scored; fallback formula is used client-side
ALTER TABLE articles ADD COLUMN IF NOT EXISTS relevance_score SMALLINT DEFAULT NULL;

-- Index for sorting by relevance
CREATE INDEX IF NOT EXISTS idx_articles_relevance_score ON articles (relevance_score DESC NULLS LAST);
