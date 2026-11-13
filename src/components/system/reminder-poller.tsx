"use client";

import { useEffect, useRef } from "react";

const EVERY_MS = 10 * 60_000;

/**
 * Fallback alongside the optional scheduler: dispatch while a tab is open, on mount,
 * every ten minutes, and whenever the tab returns to the foreground. The action is idempotent
 * and no-ops when nothing is due, so calling it often is harmless.
 */
export function ReminderPoller() {
  const running = useRef(false);

  useEffect(() => {
    let controller: AbortController | undefined;
    let disposed = false;
    let lastPoll = 0;
    const tick = () => {
      if (disposed || running.current || document.visibilityState !== "visible" || Date.now() - lastPoll < 30_000) return;
      lastPoll = Date.now();
      running.current = true;
      controller = new AbortController();
      fetch("/api/reminders/dispatch", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal })
        // The route invalidates data for the next navigation. Refreshing the current
        // page here can replace controls while the user is touching or editing them.
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
        });
    };

    // Let initial rendering and the user's first interaction finish before background work.
    const initial = window.setTimeout(tick, 1_000);
    const id = window.setInterval(tick, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearTimeout(initial);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
