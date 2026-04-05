"use client";

import { useEffect } from "react";
import type { ThemeMode } from "@/lib/hooks/use-settings";

const SETTINGS_KEY = "ai-pulse-settings";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "dark";
    const parsed = JSON.parse(raw) as { theme?: ThemeMode };
    return parsed.theme ?? "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.classList.toggle("light", !prefersDark);
  } else {
    root.classList.toggle("dark", mode === "dark");
    root.classList.toggle("light", mode === "light");
  }
}

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  useEffect(() => {
    // Apply stored theme on mount
    applyTheme(getStoredTheme());

    // Listen for localStorage changes (from Settings page)
    const handleStorage = () => {
      applyTheme(getStoredTheme());
    };

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    };

    window.addEventListener("storage", handleStorage);
    mediaQuery.addEventListener("change", handleMediaChange);

    // Also observe for same-tab localStorage writes via a custom event
    const handleCustom = () => applyTheme(getStoredTheme());
    window.addEventListener("theme-changed", handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("theme-changed", handleCustom);
    };
  }, []);

  return <>{children}</>;
}
