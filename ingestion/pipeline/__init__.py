"""Pipeline modules: normalize, deduplicate, tag, score."""

from ingestion.pipeline.normalizer import normalize
from ingestion.pipeline.deduplicator import deduplicate
from ingestion.pipeline.tagger import tag_articles
from ingestion.pipeline.scorer import score_articles

__all__ = ["normalize", "deduplicate", "tag_articles", "score_articles"]
