"""Auto-assign topic tags based on keywords, subreddits, and platforms."""

from __future__ import annotations

from dataclasses import replace

from ingestion.models import NormalizedArticle

# Keyword → topic tag mapping
KEYWORD_TAGS: dict[str, list[str]] = {
    "llms": [
        "llm", "language model", "gpt", "claude", "gemini", "llama", "mistral",
        "chatgpt", "fine-tune", "fine-tuning", "prompt", "rag", "token",
        "context window", "instruction tuning",
    ],
    "computer-vision": [
        "computer vision", "image generation", "diffusion", "stable diffusion",
        "midjourney", "dall-e", "object detection", "segmentation", "video generation",
    ],
    "reinforcement-learning": [
        "reinforcement learning", "rlhf", "reward model", "ppo", "dpo",
    ],
    "ai-safety": [
        "ai safety", "alignment", "interpretability", "red team", "jailbreak",
        "guardrail", "governance", "regulation", "responsible ai", "ethics",
    ],
    "mlops": [
        "mlops", "deployment", "serving", "inference", "training infrastructure",
        "gpu cluster", "distributed training", "quantization", "pruning",
    ],
    "open-source-models": [
        "open source", "open-source", "open weight", "llama", "mistral", "qwen",
        "phi", "gemma", "local llm", "ollama", "hugging face",
    ],
    "multimodal": [
        "multimodal", "vision-language", "audio model", "speech", "text-to-image",
        "image-to-text", "video understanding",
    ],
    "agents": [
        "agent", "tool use", "function calling", "mcp", "autonomous",
        "chain of thought", "reasoning", "planning",
    ],
    "hardware": [
        "gpu", "tpu", "nvidia", "a100", "h100", "b200", "chip", "hardware",
        "inference chip", "training hardware",
    ],
    "startups": [
        "startup", "funding", "series a", "series b", "acquisition", "launch",
        "product", "valuation", "ipo",
    ],
}

# Subreddit → topic tag overrides
SUBREDDIT_TAGS: dict[str, list[str]] = {
    "MachineLearning": ["llms"],
    "LocalLLaMA": ["llms", "open-source-models"],
    "artificial": ["llms"],
    "singularity": ["ai-safety"],
    "StableDiffusion": ["computer-vision"],
}


def tag_articles(articles: list[NormalizedArticle]) -> list[NormalizedArticle]:
    """Assign topic tags to each article based on keywords and metadata."""
    return [_tag_one(article) for article in articles]


def _tag_one(article: NormalizedArticle) -> NormalizedArticle:
    tags: set[str] = set()

    # Text to search for keywords
    text = f"{article.title} {article.summary_snippet or ''}".lower()

    # Keyword matching
    for topic, keywords in KEYWORD_TAGS.items():
        for keyword in keywords:
            if keyword.lower() in text:
                tags.add(topic)
                break

    # Subreddit override
    subreddit = article.engagement_metrics.get("subreddit")
    if isinstance(subreddit, str) and subreddit in SUBREDDIT_TAGS:
        tags.update(SUBREDDIT_TAGS[subreddit])

    # Platform-based defaults
    if article.platform == "arxiv" and not tags:
        tags.add("llms")
    if article.platform == "github" and not tags:
        tags.add("open-source-models")

    return replace(article, topic_tags=sorted(tags))
