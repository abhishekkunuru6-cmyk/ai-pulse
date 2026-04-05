"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Platform } from "@/types";

export type ThemeMode = "dark" | "light" | "system";

export type DigestArticleCount = 15 | 25 | 50;

export interface RankingWeights {
  readonly virality: number;
  readonly recency: number;
  readonly researchInterest: number;
}

export interface AppSettings {
  readonly theme: ThemeMode;
  readonly minRelevanceScore: number;
  readonly digestArticleCount: DigestArticleCount;
  readonly boostedKeywords: readonly string[];
  readonly blockedKeywords: readonly string[];
  readonly hiddenPlatforms: readonly Platform[];
  readonly rankingWeights: RankingWeights;
}

const SETTINGS_KEY = "ai-pulse-settings";

const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  virality: 50,
  recency: 50,
  researchInterest: 50,
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  minRelevanceScore: 0,
  digestArticleCount: 15,
  boostedKeywords: [],
  blockedKeywords: [],
  hiddenPlatforms: [],
  rankingWeights: DEFAULT_RANKING_WEIGHTS,
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      minRelevanceScore: parsed.minRelevanceScore ?? DEFAULT_SETTINGS.minRelevanceScore,
      digestArticleCount: parsed.digestArticleCount ?? DEFAULT_SETTINGS.digestArticleCount,
      boostedKeywords: parsed.boostedKeywords ?? DEFAULT_SETTINGS.boostedKeywords,
      blockedKeywords: parsed.blockedKeywords ?? DEFAULT_SETTINGS.blockedKeywords,
      hiddenPlatforms: parsed.hiddenPlatforms ?? DEFAULT_SETTINGS.hiddenPlatforms,
      rankingWeights: parsed.rankingWeights ?? DEFAULT_SETTINGS.rankingWeights,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("theme-changed"));
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setSettingsState(loadSettings());
    setIsLoaded(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const addBoostedKeyword = useCallback((keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;
    setSettingsState((prev) => {
      if (prev.boostedKeywords.includes(trimmed)) return prev;
      const next = { ...prev, boostedKeywords: [...prev.boostedKeywords, trimmed] };
      saveSettings(next);
      return next;
    });
  }, []);

  const removeBoostedKeyword = useCallback((keyword: string) => {
    setSettingsState((prev) => {
      const next = { ...prev, boostedKeywords: prev.boostedKeywords.filter((k) => k !== keyword) };
      saveSettings(next);
      return next;
    });
  }, []);

  const addBlockedKeyword = useCallback((keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;
    setSettingsState((prev) => {
      if (prev.blockedKeywords.includes(trimmed)) return prev;
      const next = { ...prev, blockedKeywords: [...prev.blockedKeywords, trimmed] };
      saveSettings(next);
      return next;
    });
  }, []);

  const removeBlockedKeyword = useCallback((keyword: string) => {
    setSettingsState((prev) => {
      const next = { ...prev, blockedKeywords: prev.blockedKeywords.filter((k) => k !== keyword) };
      saveSettings(next);
      return next;
    });
  }, []);

  const togglePlatformVisibility = useCallback((platform: Platform) => {
    setSettingsState((prev) => {
      const isHidden = prev.hiddenPlatforms.includes(platform);
      const next = {
        ...prev,
        hiddenPlatforms: isHidden
          ? prev.hiddenPlatforms.filter((p) => p !== platform)
          : [...prev.hiddenPlatforms, platform],
      };
      saveSettings(next);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      settings,
      isLoaded,
      updateSettings,
      addBoostedKeyword,
      removeBoostedKeyword,
      addBlockedKeyword,
      removeBlockedKeyword,
      togglePlatformVisibility,
    }),
    [
      settings,
      isLoaded,
      updateSettings,
      addBoostedKeyword,
      removeBoostedKeyword,
      addBlockedKeyword,
      removeBlockedKeyword,
      togglePlatformVisibility,
    ],
  );
}
