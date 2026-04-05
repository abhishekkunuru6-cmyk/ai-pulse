"use client";

import { useCallback, useMemo } from "react";
import { useSettings } from "./use-settings";
import type { Article } from "@/types";
import type { TopicCluster } from "@/types/topics";
import type { DigestBySourceGroup } from "@/lib/api-client";

/**
 * Checks if an article's text (title, summary, tags) matches any keyword in the list.
 */
function matchesKeyword(article: Article, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return false;
  const text = [article.title, article.summary_snippet ?? "", ...article.topic_tags]
    .join(" ")
    .toLowerCase();
  return keywords.some((kw) => text.includes(kw));
}

/**
 * Provides client-side filtering functions based on user settings.
 * - Hides articles from hidden platforms
 * - Hides articles below min relevance score
 * - Hides articles matching blocked keywords
 * - (Boosted keywords don't filter — they're used for sorting)
 */
export function useSettingsFilter() {
  const { settings, isLoaded } = useSettings();

  const filterArticle = useCallback(
    (article: Article): boolean => {
      // Hide articles from hidden platforms
      if (settings.hiddenPlatforms.includes(article.platform)) return false;

      // Hide articles below min relevance score
      if (settings.minRelevanceScore > 0 && article.engagement_score < settings.minRelevanceScore) {
        return false;
      }

      // Hide articles matching blocked keywords
      if (matchesKeyword(article, settings.blockedKeywords)) return false;

      return true;
    },
    [settings.hiddenPlatforms, settings.minRelevanceScore, settings.blockedKeywords],
  );

  const isBoosted = useCallback(
    (article: Article): boolean => {
      return matchesKeyword(article, settings.boostedKeywords);
    },
    [settings.boostedKeywords],
  );

  const filterArticles = useCallback(
    (articles: readonly Article[]): readonly Article[] => {
      const filtered = articles.filter(filterArticle);

      // If there are boosted keywords, sort boosted articles to the top
      if (settings.boostedKeywords.length === 0) return filtered;

      const boosted: Article[] = [];
      const rest: Article[] = [];
      for (const article of filtered) {
        if (isBoosted(article)) {
          boosted.push(article);
        } else {
          rest.push(article);
        }
      }
      return [...boosted, ...rest];
    },
    [filterArticle, isBoosted, settings.boostedKeywords.length],
  );

  /**
   * Filter for digest/curated contexts — skips minRelevanceScore since
   * digest articles are already ranked by quality on the server.
   */
  const filterArticlesForDigest = useCallback(
    (articles: readonly Article[]): readonly Article[] => {
      const filtered = articles.filter((article) => {
        if (settings.hiddenPlatforms.includes(article.platform)) return false;
        if (matchesKeyword(article, settings.blockedKeywords)) return false;
        return true;
      });

      if (settings.boostedKeywords.length === 0) return filtered;

      const boosted: Article[] = [];
      const rest: Article[] = [];
      for (const article of filtered) {
        if (isBoosted(article)) {
          boosted.push(article);
        } else {
          rest.push(article);
        }
      }
      return [...boosted, ...rest];
    },
    [
      settings.hiddenPlatforms,
      settings.blockedKeywords,
      settings.boostedKeywords.length,
      isBoosted,
    ],
  );

  const filterTopics = useCallback(
    (topics: readonly TopicCluster[]): readonly TopicCluster[] => {
      if (settings.hiddenPlatforms.length === 0 && settings.blockedKeywords.length === 0) {
        return topics;
      }

      return topics.filter((topic) => {
        // Hide topics where all platforms are hidden
        if (
          settings.hiddenPlatforms.length > 0 &&
          topic.platforms.every((p) => settings.hiddenPlatforms.includes(p))
        ) {
          return false;
        }

        // Hide topics matching blocked keywords (check label + summary)
        if (settings.blockedKeywords.length > 0) {
          const text = `${topic.label} ${topic.summary}`.toLowerCase();
          if (settings.blockedKeywords.some((kw) => text.includes(kw))) {
            return false;
          }
        }

        return true;
      });
    },
    [settings.hiddenPlatforms, settings.blockedKeywords],
  );

  const filterDigestGroups = useCallback(
    (groups: readonly DigestBySourceGroup[]): readonly DigestBySourceGroup[] => {
      return groups
        .filter(
          (group) => !settings.hiddenPlatforms.includes(group.platform as Article["platform"]),
        )
        .map((group) => ({
          ...group,
          articles: filterArticlesForDigest(group.articles),
        }))
        .filter((group) => group.articles.length > 0);
    },
    [settings.hiddenPlatforms, filterArticlesForDigest],
  );

  return useMemo(
    () => ({
      isLoaded,
      filterArticle,
      filterArticles,
      filterArticlesForDigest,
      filterTopics,
      filterDigestGroups,
      hasActiveFilters:
        settings.hiddenPlatforms.length > 0 ||
        settings.minRelevanceScore > 0 ||
        settings.blockedKeywords.length > 0 ||
        settings.boostedKeywords.length > 0,
    }),
    [
      isLoaded,
      filterArticle,
      filterArticles,
      filterArticlesForDigest,
      filterTopics,
      filterDigestGroups,
      settings.hiddenPlatforms.length,
      settings.minRelevanceScore,
      settings.blockedKeywords.length,
      settings.boostedKeywords.length,
    ],
  );
}
