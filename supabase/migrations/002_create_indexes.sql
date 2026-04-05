-- =============================================================================
-- 002: Create indexes for AI Pulse
-- =============================================================================

-- Articles indexes
CREATE INDEX idx_articles_source_id     ON articles (source_id);
CREATE INDEX idx_articles_published_at  ON articles (published_at DESC);
CREATE INDEX idx_articles_content_type  ON articles (content_type);
CREATE INDEX idx_articles_platform      ON articles (platform);
CREATE INDEX idx_articles_is_read       ON articles (is_read);
CREATE INDEX idx_articles_is_saved      ON articles (is_saved);
CREATE INDEX idx_articles_topic_tags    ON articles USING GIN (topic_tags);

-- Sources indexes
CREATE INDEX idx_sources_status         ON sources (status);
CREATE INDEX idx_sources_category       ON sources (category);
