import type { Article } from "@/types";

/**
 * Hard cap: no single platform can exceed this fraction of the final list.
 * With 0.25, a 20-article feed allows at most 5 from any one platform.
 */
const MAX_PLATFORM_RATIO = 0.25;

/**
 * Enforce platform diversity using a round-robin interleave.
 *
 * Instead of taking articles in score order and capping per platform
 * (which still lets dominant platforms fill 30%+ each), this function
 * interleaves across platforms so every represented platform gets
 * roughly equal slots.
 *
 * Algorithm:
 *  1. Group articles by platform (preserving within-group sort order)
 *  2. Round-robin across platforms: take 1 from each, repeat
 *  3. Hard-cap each platform at `floor(limit * MAX_PLATFORM_RATIO)`
 *  4. If we can't fill the limit (not enough platforms), relax the cap
 *     and add more from the highest-scored remaining articles
 */
export function diversifyByPlatform(
  articles: readonly Article[],
  limit: number,
  maxPlatformRatio: number = MAX_PLATFORM_RATIO,
): readonly Article[] {
  if (articles.length === 0 || limit <= 0) return [];

  // Step 1: Group by platform, preserving original sort order within each group
  const byPlatform = new Map<string, Article[]>();
  for (const article of articles) {
    const list = byPlatform.get(article.platform);
    if (list) {
      list.push(article);
    } else {
      byPlatform.set(article.platform, [article]);
    }
  }

  const platformCount = byPlatform.size;
  if (platformCount === 0) return [];

  // Step 2: Compute hard cap per platform
  const hardCap = Math.max(Math.floor(limit * maxPlatformRatio), 1);

  // Step 3: Round-robin interleave
  // Sort platforms by their best article's score so higher-quality platforms
  // get picked first within each round
  const platformOrder = [...byPlatform.entries()]
    .sort((a, b) => {
      const scoreA = Number(a[1][0]?.engagement_score ?? 0);
      const scoreB = Number(b[1][0]?.engagement_score ?? 0);
      return scoreB - scoreA;
    })
    .map(([platform]) => platform);

  const selected: Article[] = [];
  const platformTaken = new Map<string, number>();
  const platformIndex = new Map<string, number>();

  for (const p of platformOrder) {
    platformTaken.set(p, 0);
    platformIndex.set(p, 0);
  }

  // Keep doing rounds until we fill the limit or exhaust all platforms
  let madeProgress = true;
  while (selected.length < limit && madeProgress) {
    madeProgress = false;
    for (const platform of platformOrder) {
      if (selected.length >= limit) break;

      const taken = platformTaken.get(platform)!;
      if (taken >= hardCap) continue;

      const idx = platformIndex.get(platform)!;
      const platformArticles = byPlatform.get(platform)!;
      if (idx >= platformArticles.length) continue;

      selected.push(platformArticles[idx]);
      platformTaken.set(platform, taken + 1);
      platformIndex.set(platform, idx + 1);
      madeProgress = true;
    }
  }

  // Step 4: If we still haven't filled the limit (all platforms exhausted
  // or hit cap), do another round-robin with a relaxed cap (2× original).
  // This ensures overflow slots are still distributed across platforms
  // rather than letting the highest-scoring platform grab them all.
  if (selected.length < limit) {
    const relaxedCap = hardCap * 2;
    let overflowProgress = true;
    while (selected.length < limit && overflowProgress) {
      overflowProgress = false;
      for (const platform of platformOrder) {
        if (selected.length >= limit) break;

        const taken = platformTaken.get(platform)!;
        if (taken >= relaxedCap) continue;

        const idx = platformIndex.get(platform)!;
        const platformArticles = byPlatform.get(platform)!;
        if (idx >= platformArticles.length) continue;

        selected.push(platformArticles[idx]);
        platformTaken.set(platform, taken + 1);
        platformIndex.set(platform, idx + 1);
        overflowProgress = true;
      }
    }
  }

  // Step 5: Final fallback — if still not full (very few articles overall),
  // add remaining articles regardless of platform cap
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((a) => a.id));
    for (const article of articles) {
      if (selected.length >= limit) break;
      if (!selectedIds.has(article.id)) {
        selected.push(article);
      }
    }
  }

  return selected;
}
