"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps a form value mirrored to `localStorage` so a reload, a crash, or a lost connection
 * doesn't cost the user their words. Returns the live value, a setter, a `restored` flag (true
 * when the initial value came from a saved draft rather than the server), and `clear()` to call
 * once the value is safely persisted server-side.
 *
 * SSR-safe: the first render uses `serverValue`; the saved draft, if any, is applied in an
 * effect so server and client markup match.
 */
export function useLocalDraft(key: string, serverValue: string) {
  const [value, setValue] = useState(serverValue);
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  // One-time: adopt a saved draft if it differs from what the server gave us. Deferred a tick
  // so it runs as its own update (after hydration), not synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      hydrated.current = true;
      try {
        const saved = window.localStorage.getItem(key);
        if (saved != null && saved !== serverValue) {
          setValue(saved);
          setRestored(true);
        }
      } catch {
        /* storage unavailable — carry on with the server value */
      }
    });
    return () => {
      cancelled = true;
    };
    // key is stable per form; serverValue only matters on that first pass
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Mirror every change (skip the pre-hydration render).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (value === serverValue || value === "") window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, [key, value, serverValue]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setRestored(false);
  }, [key]);

  return { value, setValue, restored, clear };
}
