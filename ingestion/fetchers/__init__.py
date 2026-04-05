"""Fetcher modules for various content sources."""

from ingestion.fetchers.arxiv import ArXivFetcher
from ingestion.fetchers.base import BaseFetcher
from ingestion.fetchers.github_trending import GitHubTrendingFetcher
from ingestion.fetchers.hackernews import HackerNewsFetcher
from ingestion.fetchers.huggingface import HuggingFaceFetcher
from ingestion.fetchers.openreview import OpenReviewFetcher
from ingestion.fetchers.papers_with_code import PapersWithCodeFetcher
from ingestion.fetchers.reddit import RedditFetcher
from ingestion.fetchers.rss import RSSFetcher
from ingestion.fetchers.semantic_scholar import SemanticScholarFetcher

__all__ = [
    "ArXivFetcher",
    "BaseFetcher",
    "GitHubTrendingFetcher",
    "HackerNewsFetcher",
    "HuggingFaceFetcher",
    "OpenReviewFetcher",
    "PapersWithCodeFetcher",
    "RedditFetcher",
    "RSSFetcher",
    "SemanticScholarFetcher",
]
