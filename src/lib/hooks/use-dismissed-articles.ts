"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "ai-pulse-dismissed-articles";

function loadDismissed(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useDismissedArticles() {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const undismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const isDismissed = useCallback(
    (id: string) => dismissed.has(id),
    [dismissed],
  );

  return useMemo(
    () => ({ dismissed, dismiss, undismiss, isDismissed }),
    [dismissed, dismiss, undismiss, isDismissed],
  );
}
