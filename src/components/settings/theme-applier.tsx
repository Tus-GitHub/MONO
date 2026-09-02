"use client";

import { useEffect } from "react";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/settings/theme";

/**
 * Reconciles the server-persisted theme onto <html> after hydration. The inline boot script in
 * the root layout already handled the fast path from localStorage; this covers a fresh device
 * (empty storage) and keeps the two in sync when the choice changes elsewhere. Renders nothing.
 */
export function ThemeApplier({ theme }: { theme: Theme }) {
  useEffect(() => {
    const root = document.documentElement;
    try {
      if (theme === "light" || theme === "dark") {
        root.setAttribute("data-theme", theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } else {
        root.removeAttribute("data-theme");
        localStorage.removeItem(THEME_STORAGE_KEY);
      }
    } catch {
      /* storage blocked — the attribute set above is still the important part */
    }
  }, [theme]);

  return null;
}
