"use client";

import { useEffect, useRef } from "react";

import { dispatchMyRemindersAction } from "@/server/actions/reminders";

const EVERY_MS = 10 * 60_000;

/**
 * MONO has no cron. This keeps due reminders flowing while any tab is open: dispatch on mount,
 * every ten minutes, and whenever the tab returns to the foreground. The action is idempotent
 * and no-ops when nothing is due, so calling it often is harmless.
 */
export function ReminderPoller() {
  const running = useRef(false);

  useEffect(() => {
    const tick = () => {
      if (running.current || document.visibilityState !== "visible") return;
      running.current = true;
      dispatchMyRemindersAction()
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
        });
    };

    tick();
    const id = window.setInterval(tick, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
