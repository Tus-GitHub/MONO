"use client";

import { useEffect } from "react";

/**
 * Keyboard / viewport awareness for mobile.
 *
 * The virtual keyboard shrinks the *visual* viewport but, on iOS Safari (and in an installed
 * iOS PWA), leaves the *layout* viewport — and therefore `dvh`, `position: fixed` and sticky
 * bars — unchanged. Chromium can be told to resize the layout viewport too
 * (`interactive-widget=resizes-content`, set in the root viewport export), but Safari can't.
 *
 * This component fills the gap with `window.visualViewport`, exposing three things that CSS can
 * key off, updated on a rAF so there's no layout thrash:
 *
 *   --kb    px the keyboard (plus any bottom browser chrome) covers at the bottom edge
 *   --vvh   the true visible height in px — for capping modal / sheet heights
 *   [data-kb="open"] on <html> once --kb passes a small threshold
 *
 * It also nudges a newly-focused field into view once the keyboard has settled, using the
 * browser's own `scrollIntoView` (with `block: "nearest"` so the page doesn't jump further
 * than it has to). Everything degrades to a no-op where `visualViewport` is absent (older
 * browsers, most desktops) — the `dvh`-based fallbacks in the CSS then apply unchanged.
 */
export function ViewportManager() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    // A keyboard-sized occlusion; anything smaller is browser chrome jitter, not a keyboard.
    const KB_THRESHOLD = 120;
    let frame = 0;

    const apply = () => {
      frame = 0;
      // How much the visible area is inset from the bottom of the layout viewport.
      const bottomInset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      root.style.setProperty("--kb", `${Math.round(bottomInset)}px`);
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      const open = bottomInset > KB_THRESHOLD;
      if (open) root.setAttribute("data-kb", "open");
      else root.removeAttribute("data-kb");
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);

    // Keep a focused field clear of the keyboard. Native focus scrolling handles the simple
    // cases; this covers the ones it misses — fields inside our own scroll containers, and
    // fields the (about-to-appear) keyboard will cover.
    let focusTimer: number | undefined;
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
      if (!el || !el.matches?.("input, select, textarea, [contenteditable]")) return;
      if (el.matches('[type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"]')) return;
      window.clearTimeout(focusTimer);
      // Wait for the keyboard animation + a viewport update before measuring.
      focusTimer = window.setTimeout(() => {
        const kb = parseFloat(getComputedStyle(root).getPropertyValue("--kb")) || 0;
        const rect = el.getBoundingClientRect();
        const safeBottom = (window.visualViewport?.height ?? window.innerHeight);
        const hiddenBelow = rect.bottom > safeBottom - 8;
        const hiddenAbove = rect.top < 8;
        if (kb > KB_THRESHOLD ? hiddenBelow || hiddenAbove : hiddenAbove) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 300);
    };
    document.addEventListener("focusin", onFocusIn);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("focusin", onFocusIn);
      root.style.removeProperty("--kb");
      root.style.removeProperty("--vvh");
      root.removeAttribute("data-kb");
    };
  }, []);

  return null;
}
