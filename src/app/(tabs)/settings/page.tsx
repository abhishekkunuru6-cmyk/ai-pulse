"use client";

import { useCallback, useState } from "react";
import { useSettings, type ThemeMode, type RankingWeights } from "@/lib/hooks/use-settings";
import { PLATFORM_META } from "@/lib/utils/platform-meta";
import { IconX, IconRefresh } from "@/components/ui/icon";
import type { Platform } from "@/types";

interface IngestResult {
  readonly fetched: number;
  readonly deduplicated: number;
  readonly stored: number;
}

const THEME_OPTIONS: readonly { value: ThemeMode; label: string; description: string }[] = [
  { value: "dark", label: "Dark", description: "Always dark" },
  { value: "light", label: "Light", description: "Always light" },
  { value: "system", label: "System", description: "Follow OS" },
];

const RELEVANCE_STEPS = [0, 0.3, 0.5, 1.0, 1.5, 2.0] as const;

const FEED_PLATFORMS: readonly Platform[] = [
  "hackernews",
  "reddit",
  "arxiv",
  "github",
  "huggingface",
  "youtube",
  "blog",
  "newsletter",
];

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{title}</h3>
  );
}

function KeywordInput({
  placeholder,
  onAdd,
}: {
  readonly placeholder: string;
  readonly onAdd: (keyword: string) => void;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder={placeholder}
        className="flex-1 bg-surface-3 text-sm text-zinc-100 rounded-lg px-3 py-2 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-brand-600"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-brand-500 transition-colors"
      >
        Add
      </button>
    </div>
  );
}

function KeywordTag({
  keyword,
  onRemove,
  colorClass,
}: {
  readonly keyword: string;
  readonly onRemove: () => void;
  readonly colorClass: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${colorClass}`}>
      {keyword}
      <button
        onClick={onRemove}
        className="hover:text-white transition-colors"
        aria-label={`Remove ${keyword}`}
      >
        <IconX className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function SettingsPage() {
  const {
    settings,
    isLoaded,
    updateSettings,
    addBoostedKeyword,
    removeBoostedKeyword,
    addBlockedKeyword,
    removeBlockedKeyword,
    togglePlatformVisibility,
  } = useSettings();

  if (!isLoaded) {
    return (
      <div className="px-4 pt-3">
        <h2 className="text-lg font-bold text-zinc-100">Settings</h2>
        <div className="mt-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 pt-3">
        <h2 className="text-lg font-bold text-zinc-100">Settings</h2>
        <p className="text-xs text-muted">Customize your AI Pulse experience</p>
      </div>

      {/* Theme */}
      <div className="px-4">
        <SectionHeader title="Theme" />
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => updateSettings({ theme: value })}
              className={`rounded-xl p-3 text-center transition-colors border ${
                settings.theme === value
                  ? "border-brand-600 bg-brand-600/10"
                  : "border-zinc-800 bg-surface-2 hover:border-zinc-700"
              }`}
            >
              <p
                className={`text-sm font-medium ${settings.theme === value ? "text-brand-400" : "text-zinc-100"}`}
              >
                {label}
              </p>
              <p className="text-[10px] text-muted mt-0.5">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Minimum Engagement Score */}
      <div className="px-4">
        <SectionHeader title="Minimum Engagement Score" />
        <p className="text-[11px] text-zinc-500 mb-3">
          Hide articles with low engagement (upvotes, stars, points) from your feed.
        </p>
        <div className="flex gap-2 flex-wrap">
          {RELEVANCE_STEPS.map((score) => (
            <button
              key={score}
              onClick={() => updateSettings({ minRelevanceScore: score })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                settings.minRelevanceScore === score
                  ? "bg-brand-600 text-white"
                  : "bg-surface-2 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {score === 0 ? "Show all" : `>= ${score}`}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">
          Current:{" "}
          {settings.minRelevanceScore === 0
            ? "Showing all articles"
            : `Hiding articles below ${settings.minRelevanceScore}`}
        </p>
      </div>

      {/* Ranking Weights */}
      <div className="px-4">
        <SectionHeader title="Ranking Weights" />
        <p className="text-[11px] text-zinc-500 mb-4">
          Adjust how articles are ranked in your feed. Higher values give more weight to that
          factor.
        </p>
        <div className="space-y-4">
          {(
            [
              {
                key: "virality" as const,
                label: "Virality",
                description: "Upvotes, stars, shares, and social buzz",
                color: "accent-orange-500",
              },
              {
                key: "recency" as const,
                label: "Recency",
                description: "Newer content ranks higher",
                color: "accent-blue-500",
              },
              {
                key: "researchInterest" as const,
                label: "Research Interest",
                description: "Academic papers, citations, technical depth",
                color: "accent-purple-500",
              },
            ] as const
          ).map(({ key, label, description, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm text-zinc-100 font-medium">{label}</span>
                  <p className="text-[10px] text-zinc-500">{description}</p>
                </div>
                <span className="text-xs font-mono text-zinc-400 bg-surface-2 px-2 py-0.5 rounded">
                  {settings.rankingWeights[key]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.rankingWeights[key]}
                onChange={(e) =>
                  updateSettings({
                    rankingWeights: {
                      ...settings.rankingWeights,
                      [key]: Number(e.target.value),
                    },
                  })
                }
                className={`w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 ${color} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Boosted Keywords */}
      <div className="px-4">
        <SectionHeader title="Boosted Keywords" />
        <p className="text-[11px] text-zinc-500 mb-3">
          Articles matching these keywords will be prioritized in your feed.
        </p>
        <KeywordInput placeholder="e.g. transformer, RAG, agents" onAdd={addBoostedKeyword} />
        {settings.boostedKeywords.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-3">
            {settings.boostedKeywords.map((kw) => (
              <KeywordTag
                key={kw}
                keyword={kw}
                onRemove={() => removeBoostedKeyword(kw)}
                colorClass="bg-green-600/20 text-green-400"
              />
            ))}
          </div>
        )}
      </div>

      {/* Blocked Keywords */}
      <div className="px-4">
        <SectionHeader title="Blocked Keywords" />
        <p className="text-[11px] text-zinc-500 mb-3">
          Articles matching these keywords will be hidden from your feed.
        </p>
        <KeywordInput placeholder="e.g. crypto, nft, web3" onAdd={addBlockedKeyword} />
        {settings.blockedKeywords.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-3">
            {settings.blockedKeywords.map((kw) => (
              <KeywordTag
                key={kw}
                keyword={kw}
                onRemove={() => removeBlockedKeyword(kw)}
                colorClass="bg-red-600/20 text-red-400"
              />
            ))}
          </div>
        )}
      </div>

      {/* Platform Visibility */}
      <div className="px-4">
        <SectionHeader title="Platform Visibility" />
        <p className="text-[11px] text-zinc-500 mb-3">
          Toggle which platforms appear in your feed.
        </p>
        <div className="space-y-2">
          {FEED_PLATFORMS.map((platform) => {
            const meta = PLATFORM_META[platform];
            const isHidden = settings.hiddenPlatforms.includes(platform);
            return (
              <button
                key={platform}
                onClick={() => togglePlatformVisibility(platform)}
                className="w-full flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.bgClass} ${meta.colorClass}`}
                  >
                    {meta.abbreviation}
                  </span>
                  <span className={`text-sm ${isHidden ? "text-zinc-500" : "text-zinc-100"}`}>
                    {meta.label}
                  </span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full transition-colors flex items-center ${
                    isHidden ? "bg-zinc-700 justify-start" : "bg-brand-600 justify-end"
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow-sm" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fetch Latest */}
      <FetchSection />

      {/* Recompute Scores */}
      <RecomputeSection rankingWeights={settings.rankingWeights} />

      {/* Compute Personalized Relevance */}
      <RelevanceSection
        boostedKeywords={settings.boostedKeywords}
        blockedKeywords={settings.blockedKeywords}
      />

      {/* Backfill Historical Content */}
      <BackfillSection />

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}

function FetchSection() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerFetch = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: "all" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
      } else {
        setResult(json.data as IngestResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsRunning(false);
    }
  }, []);

  return (
    <div className="px-4">
      <SectionHeader title="Data Ingestion" />
      <p className="text-[11px] text-zinc-500 mb-3">
        Fetch the latest articles from all configured sources.
      </p>
      <button
        onClick={triggerFetch}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-600/30 bg-brand-600/5 hover:bg-brand-600/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IconRefresh className={`w-4 h-4 text-brand-400 ${isRunning ? "animate-spin" : ""}`} />
        <span className="text-sm font-medium text-brand-300">
          {isRunning ? "Fetching from all sources..." : "Fetch Latest"}
        </span>
      </button>

      {isRunning && (
        <p className="text-[10px] text-zinc-500 mt-2 text-center">
          This may take 2-3 minutes. Please wait.
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-green-600/10 border border-green-600/20 p-3">
          <p className="text-xs font-medium text-green-400 mb-1">Ingestion complete</p>
          <div className="flex gap-4 text-[11px] text-green-300/70">
            <span>Fetched: {result.fetched}</span>
            <span>Deduped: {result.deduplicated}</span>
            <span>Stored: {result.stored}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/10 border border-red-600/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

function RecomputeSection({
  rankingWeights,
}: {
  readonly rankingWeights: import("@/lib/hooks/use-settings").RankingWeights;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ total: number; updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerRecompute = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rankingWeights),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
      } else {
        setResult(json.data as { total: number; updated: number });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsRunning(false);
    }
  }, [rankingWeights]);

  return (
    <div className="px-4">
      <SectionHeader title="Recompute Scores" />
      <p className="text-[11px] text-zinc-500 mb-3">
        Recalculate all article relevance and hotness scores using your current ranking weights.
      </p>
      <button
        onClick={triggerRecompute}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-600/30 bg-purple-600/5 hover:bg-purple-600/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IconRefresh className={`w-4 h-4 text-purple-400 ${isRunning ? "animate-spin" : ""}`} />
        <span className="text-sm font-medium text-purple-300">
          {isRunning ? "Recomputing scores..." : "Recompute All Scores"}
        </span>
      </button>

      {isRunning && (
        <p className="text-[10px] text-zinc-500 mt-2 text-center">
          Processing all articles. This may take a moment.
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-purple-600/10 border border-purple-600/20 p-3">
          <p className="text-xs font-medium text-purple-400 mb-1">Recompute complete</p>
          <div className="flex gap-4 text-[11px] text-purple-300/70">
            <span>Total: {result.total}</span>
            <span>Updated: {result.updated}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/10 border border-red-600/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

function RelevanceSection({
  boostedKeywords,
  blockedKeywords,
}: {
  readonly boostedKeywords: readonly string[];
  readonly blockedKeywords: readonly string[];
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    scored: number;
    llmPowered: boolean;
    profileStrength: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerRelevance = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/relevance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boostedKeywords, blockedKeywords, limit: 100 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
      } else {
        setResult(json.data as { scored: number; llmPowered: boolean; profileStrength: number });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsRunning(false);
    }
  }, [boostedKeywords, blockedKeywords]);

  return (
    <div className="px-4">
      <SectionHeader title="Personalized Relevance" />
      <p className="text-[11px] text-zinc-500 mb-3">
        Score articles based on your like/dislike history and keyword preferences using AI.
      </p>
      <button
        onClick={triggerRelevance}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-600/30 bg-blue-600/5 hover:bg-blue-600/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IconRefresh className={`w-4 h-4 text-blue-400 ${isRunning ? "animate-spin" : ""}`} />
        <span className="text-sm font-medium text-blue-300">
          {isRunning ? "Computing relevance..." : "Compute Relevance Scores"}
        </span>
      </button>

      {isRunning && (
        <p className="text-[10px] text-zinc-500 mt-2 text-center">
          Analyzing your preferences and scoring articles. This may take a moment.
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-blue-600/10 border border-blue-600/20 p-3">
          <p className="text-xs font-medium text-blue-400 mb-1">Relevance scoring complete</p>
          <div className="flex gap-4 text-[11px] text-blue-300/70">
            <span>Scored: {result.scored} articles</span>
            <span>Method: {result.llmPowered ? "AI-powered" : "Formula-based"}</span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            Profile strength: {result.profileStrength} signals
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/10 border border-red-600/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

const BACKFILL_PERIODS = [
  { value: "1month", label: "Last 1 Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "1year", label: "Last 1 Year" },
] as const;

function BackfillSection() {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("1month");
  const [result, setResult] = useState<{
    fetched: number;
    deduplicated: number;
    stored: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerBackfill = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
      } else {
        setResult(json.data as { fetched: number; deduplicated: number; stored: number });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsRunning(false);
    }
  }, [selectedPeriod]);

  return (
    <div className="px-4">
      <SectionHeader title="Backfill Historical Content" />
      <p className="text-[11px] text-zinc-500 mb-3">
        Pull historical articles from arXiv, Hugging Face, GitHub, and other sources.
      </p>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {BACKFILL_PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedPeriod(value)}
            disabled={isRunning}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
              selectedPeriod === value
                ? "bg-amber-600 text-white"
                : "bg-surface-2 text-zinc-400 hover:text-zinc-200"
            } disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={triggerBackfill}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-600/30 bg-amber-600/5 hover:bg-amber-600/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IconRefresh className={`w-4 h-4 text-amber-400 ${isRunning ? "animate-spin" : ""}`} />
        <span className="text-sm font-medium text-amber-300">
          {isRunning ? "Backfilling..." : "Start Backfill"}
        </span>
      </button>

      {isRunning && (
        <p className="text-[10px] text-zinc-500 mt-2 text-center">
          This may take several minutes depending on the time range.
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-amber-600/10 border border-amber-600/20 p-3">
          <p className="text-xs font-medium text-amber-400 mb-1">Backfill complete</p>
          <div className="flex gap-4 text-[11px] text-amber-300/70">
            <span>Fetched: {result.fetched}</span>
            <span>Deduped: {result.deduplicated}</span>
            <span>Stored: {result.stored}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/10 border border-red-600/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
