"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchArticles } from "@/lib/hooks/use-search-articles";
import { useRateArticle, useToggleSave } from "@/lib/hooks/use-article-mutations";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { IconChevronLeft, IconSearch } from "@/components/ui/icon";
import { ArticleCard } from "@/components/feed/article-card";
import { FeedSkeleton } from "@/components/ui/loading-skeleton";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { results, isLoading, hasSearched } = useSearchArticles(debouncedQuery);
  const { getRating, optimisticRate } = usePreferences();
  const rateMutation = useRateArticle();
  const saveMutation = useToggleSave();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 400);
  }, []);

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Search header */}
      <div className="sticky top-0 z-50 bg-surface-1/95 backdrop-blur border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-1 -ml-1 text-muted">
            <IconChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 relative">
            <IconSearch className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search articles..."
              value={query}
              onChange={handleInputChange}
              className="w-full bg-surface-2 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none border border-zinc-700 focus:border-brand-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-4">
        {hasSearched && !isLoading && (
          <p className="text-xs text-muted mb-3">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
          </p>
        )}

        {isLoading && <FeedSkeleton />}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-400">No results found</p>
            <p className="text-xs text-muted mt-1">Try different keywords</p>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                currentRating={getRating(article.id)}
                onRate={(id, rating) => {
                  optimisticRate(id, rating);
                  rateMutation.mutate({ id, rating });
                }}
                onToggleSave={(id) => saveMutation.mutate(id)}
              />
            ))}
          </div>
        )}

        {!hasSearched && (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-400">Search across all your articles</p>
            <p className="text-xs text-muted mt-1">
              Try &ldquo;transformer&rdquo;, &ldquo;llama&rdquo;, or &ldquo;fine-tuning&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
