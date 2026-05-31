import { supabase } from "@/lib/supabase/client";
import type { Article, ContentType, Platform } from "@/types";
import type { TopicCluster } from "@/types/topics";
import { diversifyByPlatform } from "@/lib/utils/diversify-feed";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "it",
  "as",
  "are",
  "was",
  "be",
  "this",
  "that",
  "can",
  "will",
  "new",
  "how",
  "what",
  "why",
  "using",
  "based",
  "via",
  "its",
  "into",
  "than",
  "more",
  "over",
  "about",
  "their",
  "our",
  "your",
  "we",
  "they",
  "has",
  "have",
  "not",
  "been",
  "do",
  "does",
  "did",
  "which",
  "when",
  "where",
  "who",
  "whom",
  "all",
  "each",
  "every",
  "both",
  "few",
  "many",
  "some",
  "any",
  "no",
  "only",
  "own",
  "same",
  "so",
  "just",
  "very",
  "too",
  "also",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "up",
  "out",
  "off",
  "down",
  "if",
  "while",
  "because",
  "until",
  "against",
  "without",
  "within",
  "along",
  "across",
  "behind",
  "beyond",
  "towards",
  "toward",
  "among",
  "upon",
  "whether",
  "however",
  "approach",
  "method",
  "model",
  "models",
  "learning",
  "data",
  "paper",
  "results",
  "performance",
  "task",
  "tasks",
  "propose",
  "proposed",
  "framework",
  "system",
  "systems",
  "show",
  "shows",
  "achieve",
  "achieves",
  "large",
  "language",
  "llms",
  "llm",
  "generation",
  "reasoning",
  "neural",
  "network",
  "networks",
  "efficient",
  "training",
  "inference",
  "evaluation",
  "benchmark",
  "benchmarks",
  "pre-trained",
  "pretrained",
  "fine-tuning",
  "image",
  "text",
  "video",
  "audio",
  "multi",
  "scale",
  "scalable",
  "representation",
  "representations",
  "feature",
  "features",
  "attention",
  "mechanism",
  "embedding",
  "embeddings",
  "token",
  "tokens",
  "generative",
  "adversarial",
  "supervised",
  "unsupervised",
  "self-supervised",
  "semi-supervised",
  "end-to-end",
  "real-time",
  "state-of-the-art",
  "novel",
  "robust",
  "robustness",
  "unified",
  "adaptive",
  "improved",
  "improving",
  "simple",
  "open",
  "source",
  "high",
  "low",
  "first",
  "towards",
  "beyond",
  "enabling",
  "leveraging",
  "exploring",
  "understanding",
  "rethinking",
  "revisiting",
  "introducing",
  "general",
  "purpose",
  "cross",
  "domain",
  "multi-modal",
  "multimodal",
  "deep",
  "dynamic",
  "automate",
  "automated",
  "automatic",
  "advanced",
  "lightweight",
  "powerful",
  "comprehensive",
  "practical",
  "fast",
  "faster",
  "anyone",
  "else",
  "doesn",
  "don",
  "didn",
  "isn",
  "aren",
  "wasn",
  "won",
  "couldn",
  "shouldn",
  "wouldn",
  "mean",
  "think",
  "know",
  "want",
  "need",
  "like",
  "really",
  "going",
  "last",
  "week",
  "today",
  "yesterday",
  "tomorrow",
  "literally",
  "actually",
  "basically",
  "honestly",
  "gonna",
  "people",
  "everyone",
  "somebody",
  "something",
  "everything",
  "nothing",
  "always",
  "never",
  "still",
  "already",
  "getting",
  "got",
  "come",
  "came",
  "made",
  "make",
  "makes",
  "making",
  "use",
  "used",
  "uses",
  "take",
  "best",
  "good",
  "better",
  "great",
  "real",
  "look",
  "right",
  "long",
  "work",
  "works",
  "working",
  "point",
  "even",
  "much",
  "well",
  "able",
  "could",
  "would",
  "should",
  "might",
  "may",
  "let",
  "thing",
  "things",
  "way",
  "help",
  "try",
  "back",
  "time",
  "give",
  "keep",
  "see",
  "seen",
  "feel",
  "find",
  "tell",
  "believe",
  "seem",
  "call",
  "start",
  "end",
  "turn",
  "put",
  "set",
  "run",
  "said",
  "says",
]);

const TAG_DISPLAY_NAMES: Record<string, string> = {
  llms: "Large Language Models",
  "computer-vision": "Computer Vision",
  "reinforcement-learning": "Reinforcement Learning",
  "ai-safety": "AI Safety & Alignment",
  mlops: "MLOps & Infrastructure",
  "open-source-models": "Open Source Models",
  multimodal: "Multimodal AI",
  agents: "AI Agents & Tool Use",
  hardware: "AI Hardware",
  startups: "Startups & Products",
  alignment: "AI Alignment",
  other: "General AI",
};

const CTYPE_DISPLAY_NAMES: Record<string, string> = {
  "ctype-papers": "Latest Research Papers",
  "ctype-blogs": "Blog Highlights",
  "ctype-newsletters": "Newsletter Roundup",
  "ctype-videos": "Video Highlights",
  "ctype-code": "Trending GitHub Repos",
};

/**
 * Extract significant keywords from a title for clustering.
 * Returns 2-3 word phrases and important single words.
 */
function extractKeywords(title: string): readonly string[] {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Extract bigrams (2-word phrases) — these are the best topic identifiers
  // Only include bigrams where both words are 3+ chars
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 3) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  return [...bigrams, ...words];
}

/**
 * Compute a topic label from the most common keywords in a cluster.
 */
function computeTopicLabel(articles: readonly Article[]): string {
  const freq = new Map<string, number>();

  for (const article of articles) {
    const keywords = extractKeywords(article.title);
    const seen = new Set<string>();
    for (const kw of keywords) {
      if (!seen.has(kw)) {
        seen.add(kw);
        freq.set(kw, (freq.get(kw) ?? 0) + 1);
      }
    }
  }

  // Find the most frequent bigram that appears in at least 2 articles
  const sorted = [...freq.entries()]
    .filter(([kw, count]) => count >= 2 && kw.includes(" "))
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length > 0) {
    return sorted[0][0]
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Fallback to most common single word
  const singleWords = [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  if (singleWords.length > 0) {
    const word = singleWords[0][0];
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // Last resort: use the first article's dominant topic tag
  if (articles[0]?.topic_tags.length > 0) {
    return articles[0].topic_tags[0]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return "General";
}

/**
 * Deduplicate articles that have the same title (e.g. same paper from arxiv + huggingface).
 * Keeps the version with higher engagement, but preserves both platform references.
 */
function deduplicateByTitle(articles: readonly Article[]): Article[] {
  const seen = new Map<string, Article>();

  for (const article of articles) {
    const normalizedTitle = article.title.toLowerCase().trim().replace(/\s+/g, " ");
    const existing = seen.get(normalizedTitle);

    if (!existing) {
      seen.set(normalizedTitle, article);
    } else {
      // Keep the one with higher engagement
      const existingScore = Number(existing.engagement_score) || 0;
      const currentScore = Number(article.engagement_score) || 0;
      if (currentScore > existingScore) {
        seen.set(normalizedTitle, article);
      }
    }
  }

  return [...seen.values()];
}

/**
 * Cluster articles into topic groups based on title keyword similarity.
 */
function clusterArticles(articles: readonly Article[]): Map<string, Article[]> {
  // Step 1: Deduplicate articles with the same title across platforms
  const dedupedArticles = deduplicateByTitle(articles);

  // Build keyword → article mapping
  const keywordIndex = new Map<string, Set<number>>();

  for (let i = 0; i < dedupedArticles.length; i++) {
    const keywords = extractKeywords(dedupedArticles[i].title);
    for (const kw of keywords) {
      if (!keywordIndex.has(kw)) {
        keywordIndex.set(kw, new Set());
      }
      keywordIndex.get(kw)!.add(i);
    }
  }

  // Find clusters: articles that share significant keywords
  const assigned = new Set<number>();
  const clusters = new Map<string, Article[]>();

  // Sort keywords by frequency (most shared first) — prefer bigrams
  // Cap cluster size to keep topics focused (max 12 articles per keyword cluster)
  const sortedKeywords = [...keywordIndex.entries()]
    .filter(([kw, indices]) => indices.size >= 2 && kw.includes(" "))
    .sort((a, b) => b[1].size - a[1].size);

  for (const [, indices] of sortedKeywords) {
    const unassigned = [...indices].filter((i) => !assigned.has(i));
    if (unassigned.length < 2) continue;

    // Cap cluster size — take the most relevant articles (highest engagement)
    const candidateArticles = unassigned.map((i) => dedupedArticles[i]);
    const sortedByEngagement = [...candidateArticles].sort(
      (a, b) => (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0),
    );
    const cappedArticles = sortedByEngagement.slice(0, 12);
    const cappedIds = new Set(cappedArticles.map((a) => a.id));

    const label = computeTopicLabel(cappedArticles);
    const slug = label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (clusters.has(slug)) {
      for (const a of cappedArticles) {
        if (!clusters.get(slug)!.some((existing) => existing.id === a.id)) {
          clusters.get(slug)!.push(a);
        }
      }
    } else {
      clusters.set(slug, [...cappedArticles]);
    }

    // Only mark the capped articles as assigned
    for (const i of unassigned) {
      if (cappedIds.has(dedupedArticles[i].id)) {
        assigned.add(i);
      }
    }
  }

  // Step 2: Enrich keyword clusters with unassigned articles that share topic_tags.
  // Paper/blog titles use different language than code/social, so keyword clustering
  // misses them. But they often share the same topic_tags (e.g., "computer-vision").
  // This step adds related but title-dissimilar articles into existing clusters.
  const MAX_ENRICHMENT_PER_CLUSTER = 4;

  for (const [, clusterArticles] of clusters) {
    // Build a set of topic_tags present in this cluster
    const clusterTags = new Set<string>();
    for (const a of clusterArticles) {
      for (const tag of a.topic_tags) {
        clusterTags.add(tag);
      }
    }
    if (clusterTags.size === 0) continue;

    // Find unassigned articles whose topic_tags overlap with this cluster
    const candidates: Array<{ readonly index: number; readonly article: Article }> = [];
    for (let i = 0; i < dedupedArticles.length; i++) {
      if (assigned.has(i)) continue;
      const article = dedupedArticles[i];
      // Only enrich with content types that are missing from the cluster
      const clusterTypes = new Set(clusterArticles.map((a) => a.content_type));
      if (clusterTypes.has(article.content_type)) continue;
      // Check topic_tag overlap
      if (article.topic_tags.some((tag) => clusterTags.has(tag))) {
        candidates.push({ index: i, article });
      }
    }

    if (candidates.length === 0) continue;

    // Sort by engagement and take the best ones
    const sorted = [...candidates].sort(
      (a, b) =>
        (Number(b.article.engagement_score) || 0) - (Number(a.article.engagement_score) || 0),
    );
    const toAdd = sorted.slice(0, MAX_ENRICHMENT_PER_CLUSTER);

    for (const { index, article } of toAdd) {
      clusterArticles.push(article);
      assigned.add(index);
    }
  }

  // Step 3: Create content-type clusters for types that are underrepresented
  // in keyword clusters. Blogs, papers, newsletters, and code repos have diverse
  // titles that don't share bigrams, so keyword clustering misses them.
  const CONTENT_TYPE_CLUSTER_CONFIG: ReadonlyArray<{
    readonly type: ContentType;
    readonly slug: string;
    readonly minSize: number;
    readonly maxSize: number;
  }> = [
    { type: "paper", slug: "ctype-papers", minSize: 3, maxSize: 12 },
    { type: "blog", slug: "ctype-blogs", minSize: 3, maxSize: 10 },
    { type: "newsletter", slug: "ctype-newsletters", minSize: 2, maxSize: 8 },
    { type: "video", slug: "ctype-videos", minSize: 2, maxSize: 8 },
    { type: "code", slug: "ctype-code", minSize: 2, maxSize: 10 },
  ];

  for (const { type, slug, minSize, maxSize } of CONTENT_TYPE_CLUSTER_CONFIG) {
    // Count how many articles of this type are already in keyword clusters
    let alreadyClustered = 0;
    for (const arts of clusters.values()) {
      alreadyClustered += arts.filter((a) => a.content_type === type).length;
    }

    // Collect unassigned articles of this type
    const unassignedOfType: Article[] = [];
    for (let i = 0; i < dedupedArticles.length; i++) {
      if (assigned.has(i) || dedupedArticles[i].content_type !== type) continue;
      unassignedOfType.push(dedupedArticles[i]);
    }

    // Only create a content-type cluster if there are enough unclustered articles
    // AND the type is underrepresented in keyword clusters
    if (unassignedOfType.length >= minSize && alreadyClustered < maxSize) {
      const sorted = [...unassignedOfType].sort(
        (a, b) => (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0),
      );
      const selected = sorted.slice(0, maxSize);
      clusters.set(slug, selected);

      // Mark these as assigned so they don't end up in tag-based fallback
      const selectedIds = new Set(selected.map((a) => a.id));
      for (let i = 0; i < dedupedArticles.length; i++) {
        if (selectedIds.has(dedupedArticles[i].id)) {
          assigned.add(i);
        }
      }
    }
  }

  // Step 3: Remaining unassigned articles — group by topic_tag with size cap
  const unassignedByTag = new Map<string, Article[]>();
  for (let i = 0; i < dedupedArticles.length; i++) {
    if (assigned.has(i)) continue;
    const article = dedupedArticles[i];
    const tag = article.topic_tags[0] ?? "other";
    if (!unassignedByTag.has(tag)) {
      unassignedByTag.set(tag, []);
    }
    unassignedByTag.get(tag)!.push(article);
  }

  for (const [tag, tagArticles] of unassignedByTag) {
    const slug = `topic-${tag}`;
    // Cap at 10 articles, sorted by engagement
    const sorted = [...tagArticles].sort(
      (a, b) => (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0),
    );
    clusters.set(slug, sorted.slice(0, 10));
  }

  return clusters;
}

/**
 * Generate a short summary sentence describing what this topic cluster is about.
 */
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isQualitySnippet(text: string): boolean {
  // Reject URLs, reddit-style casual text, image links
  if (text.startsWith("http")) return false;
  if (text.includes("reddit.com") || text.includes("preview.redd.it")) return false;
  if (text.includes("youtu.be") || text.includes("youtube.com")) return false;
  // Reject very short or all-caps
  if (text.length < 30) return false;
  // Prefer sentences that start with a capital letter (proper writing)
  if (/^[A-Z]/.test(text)) return true;
  return text.length > 50;
}

function generateTopicSummary(label: string, articles: readonly Article[]): string {
  // Collect snippets, preferring quality content (papers, blogs) over social posts
  const priorityOrder = ["paper", "blog", "newsletter", "news", "code", "social"];
  const sortedByType = [...articles].sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.content_type);
    const bIdx = priorityOrder.indexOf(b.content_type);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  const snippets = sortedByType
    .filter((a) => a.summary_snippet)
    .map((a) => stripHtml(a.summary_snippet!))
    .filter(isQualitySnippet)
    .slice(0, 5);

  if (snippets.length > 0) {
    const first = snippets[0];
    if (first.length > 140) {
      return first.slice(0, 137) + "...";
    }
    return first;
  }

  // Fallback: try any snippet even if low quality
  const anySnippet = sortedByType
    .filter((a) => a.summary_snippet)
    .map((a) => stripHtml(a.summary_snippet!))
    .filter((s) => s.length > 20)
    .slice(0, 1);

  if (anySnippet.length > 0) {
    const s = anySnippet[0];
    return s.length > 140 ? s.slice(0, 137) + "..." : s;
  }

  // Fallback: describe from titles
  const platforms = [...new Set(articles.map((a) => a.platform))];
  const types = [...new Set(articles.map((a) => a.content_type))];
  const typeLabels = types.slice(0, 2).join(", ");
  return `${articles.length} ${typeLabels} items about ${label} from ${platforms.length} source${platforms.length > 1 ? "s" : ""}`;
}

/**
 * Compute a combined relevance score (0-100) based on recency + popularity.
 * Both factors are weighted equally.
 */
function computeHotnessScore(articles: readonly Article[]): number {
  // Pure popularity — recency is handled by the timeline filter (24h/7d/30d)
  const totalEngagement = articles.reduce((sum, a) => sum + (Number(a.engagement_score) || 0), 0);
  const avgEngagement = totalEngagement / Math.max(articles.length, 1);
  // Logarithmic scale: score of 1 → ~0, score of 10 → ~50, score of 100 → ~100
  const popularityScore = Math.min(100, 20 * Math.log2(Math.max(avgEngagement, 0.1) + 1));

  return Math.round(popularityScore);
}

/**
 * Build a TopicCluster summary from a group of articles.
 */
function buildCluster(slug: string, articles: Article[]): TopicCluster {
  // For content-type and tag-based clusters, use display name maps
  const ctypeLabel = CTYPE_DISPLAY_NAMES[slug];
  const tagMatch = slug.match(/^topic-(.+)$/);
  const label = ctypeLabel
    ? ctypeLabel
    : tagMatch && TAG_DISPLAY_NAMES[tagMatch[1]]
      ? TAG_DISPLAY_NAMES[tagMatch[1]]
      : computeTopicLabel(articles);

  const contentTypes = [...new Set(articles.map((a) => a.content_type))] as ContentType[];
  const platforms = [...new Set(articles.map((a) => a.platform))] as Platform[];

  const dates = articles
    .map((a) => a.published_at)
    .filter((d): d is string => d !== null)
    .sort();

  const totalEngagement = articles.reduce((sum, a) => sum + (Number(a.engagement_score) || 0), 0);
  const hotnessScore = computeHotnessScore(articles);

  // Sort articles by engagement score descending
  const sortedArticles = [...articles].sort(
    (a, b) => (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0),
  );

  const summary = generateTopicSummary(label, sortedArticles);

  return {
    slug,
    label,
    summary,
    article_count: articles.length,
    content_types: contentTypes,
    platforms,
    latest_date: dates.length > 0 ? dates[dates.length - 1] : null,
    oldest_date: dates.length > 0 ? dates[0] : null,
    top_articles: sortedArticles.slice(0, 4),
    article_ids: sortedArticles.map((a) => a.id),
    total_engagement: totalEngagement,
    hotness_score: hotnessScore,
    relevance_score: hotnessScore, // Default to hotness; overridden by LLM personalization
  };
}

/**
 * Fetch recent articles, diversify, and cluster them into topics.
 */
export async function getTopicClusters(
  timeRange: "today" | "week" | "month" | "year" | "all" = "week",
  limit: number = 15,
): Promise<readonly TopicCluster[]> {
  const now = new Date();
  const periodMs: Record<string, number> = {
    today: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMs[timeRange];
  const since = ms ? new Date(now.getTime() - ms) : null;

  const minEngagement = timeRange === "today" ? 0.3 : 0.5;
  const sinceIso = since ? since.toISOString() : null;

  // Main fetch: top articles by engagement (Supabase caps at ~1000 rows).
  // This naturally favours code/social which have higher scores.
  let mainQuery = supabase
    .from("articles")
    .select("*")
    .gte("engagement_score", minEngagement)
    .order("engagement_score", { ascending: false })
    .limit(2000);

  if (sinceIso) {
    mainQuery = mainQuery.gte("published_at", sinceIso);
  }

  const { data: mainData, error: mainError } = await mainQuery;

  if (mainError) throw new Error(`Failed to fetch articles for clustering: ${mainError.message}`);

  // Supplemental fetches: ensure blogs, newsletters, videos, and code repos are represented.
  // These content types have lower engagement scores and get cut off by the main
  // query's engagement-sorted limit.
  const supplementTypes: readonly ContentType[] = ["blog", "newsletter", "video", "code"];
  const mainIds = new Set((mainData ?? []).map((a: Article) => a.id));

  const supplements = await Promise.all(
    supplementTypes.map(async (type) => {
      let typeQuery = supabase
        .from("articles")
        .select("*")
        .eq("content_type", type)
        .gte("engagement_score", minEngagement)
        .order("engagement_score", { ascending: false })
        .limit(50);

      if (sinceIso) {
        typeQuery = typeQuery.gte("published_at", sinceIso);
      }

      const { data: typeData } = await typeQuery;
      // Only include articles not already in the main pool
      return ((typeData ?? []) as Article[]).filter((a) => !mainIds.has(a.id));
    }),
  );

  const rawArticles = [...((mainData ?? []) as Article[]), ...supplements.flat()];
  if (rawArticles.length === 0) return [];

  // Diversify the input pool so clustering isn't dominated by HN/Reddit.
  // 30% cap: any single platform (including github) can contribute at most 30% of the pool.
  const articles = diversifyByPlatform(rawArticles, 500, 0.3) as Article[];
  const clusterMap = clusterArticles(articles);

  // When the user requests more topics (e.g. 50), allow single-article clusters
  // to fill the gap. For lower limits, require at least 2 articles per cluster.
  const minArticles = limit > 30 ? 1 : 2;

  const clusters = [...clusterMap.entries()]
    .map(([slug, arts]) => buildCluster(slug, arts))
    .filter((c) => c.article_count >= minArticles)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  // If we still have fewer clusters than requested, promote high-engagement
  // unclustered articles as single-article topics
  if (clusters.length < limit) {
    const clusteredIds = new Set(clusters.flatMap((c) => c.article_ids));
    const unclustered = articles
      .filter((a) => !clusteredIds.has(a.id))
      .sort((a, b) => (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0));

    for (const article of unclustered) {
      if (clusters.length >= limit) break;
      const slug = `single-${article.id.slice(0, 8)}`;
      clusters.push(buildCluster(slug, [article]));
    }
  }

  return clusters.slice(0, limit);
}

/**
 * Fetch the exact articles for a topic cluster by their IDs.
 * The IDs come from the cluster list endpoint, guaranteeing consistency.
 */
export async function getTopicArticlesByIds(
  articleIds: readonly string[],
): Promise<readonly Article[]> {
  if (articleIds.length === 0) return [];

  // Supabase .in() has a limit, so batch in chunks of 100
  const BATCH = 100;
  const allArticles: Article[] = [];

  for (let i = 0; i < articleIds.length; i += BATCH) {
    const batch = articleIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .in("id", batch as string[]);

    if (error) throw new Error(`Failed to fetch topic articles: ${error.message}`);
    allArticles.push(...((data ?? []) as Article[]));
  }

  // Preserve the original order (sorted by engagement from buildCluster)
  const idOrder = new Map(articleIds.map((id, idx) => [id, idx]));
  allArticles.sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));

  return allArticles;
}
