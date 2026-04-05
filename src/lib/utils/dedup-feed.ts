import type { Article } from "@/types";

/**
 * Normalize a title for comparison: lowercase, strip punctuation,
 * remove common prefixes/suffixes, collapse whitespace.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract significant words from a normalized title (skip short words).
 */
function significantWords(normalized: string): ReadonlySet<string> {
  return new Set(
    normalized.split(" ").filter((w) => w.length >= 4),
  );
}

/**
 * Jaccard similarity between two sets of words (0 to 1).
 */
function jaccardSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate a feed of articles by removing near-duplicate titles.
 * Keeps the article with the highest engagement score when duplicates are found.
 *
 * Uses Jaccard similarity on significant title words.
 * Threshold of 0.6 catches: same paper from ArXiv + HuggingFace,
 * slight rewording, "[D]" / "[R]" Reddit prefix variants, etc.
 */
export function deduplicateFeed(
  articles: readonly Article[],
  similarityThreshold: number = 0.6,
): readonly Article[] {
  const kept: Article[] = [];
  const keptNormalized: { words: ReadonlySet<string>; normalized: string }[] = [];

  for (const article of articles) {
    const normalized = normalizeTitle(article.title);
    const words = significantWords(normalized);

    // Check if this is a near-duplicate of any kept article
    let isDuplicate = false;

    for (let i = 0; i < keptNormalized.length; i++) {
      const existing = keptNormalized[i];

      // Fast path: exact normalized match
      if (normalized === existing.normalized) {
        // Keep the one with higher engagement
        const existingScore = Number(kept[i].engagement_score) || 0;
        const currentScore = Number(article.engagement_score) || 0;
        if (currentScore > existingScore) {
          kept[i] = article;
          keptNormalized[i] = { words, normalized };
        }
        isDuplicate = true;
        break;
      }

      // Similarity check
      const similarity = jaccardSimilarity(words, existing.words);
      if (similarity >= similarityThreshold) {
        // Keep the one with higher engagement
        const existingScore = Number(kept[i].engagement_score) || 0;
        const currentScore = Number(article.engagement_score) || 0;
        if (currentScore > existingScore) {
          kept[i] = article;
          keptNormalized[i] = { words, normalized };
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(article);
      keptNormalized.push({ words, normalized });
    }
  }

  return kept;
}
