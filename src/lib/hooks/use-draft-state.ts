"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { z } from "zod";
import { encodeDraft, readDraft } from "@/lib/utils/draft";

/** Validated, versioned device drafts. Callers scope private values by user and resource. */
export function useDraftState<T>(key: string, initial: T, schema: z.ZodType<T>) {
  const base = JSON.stringify(initial);
  const identity = `${key}:${base}`;
  const [draft, setDraft] = useState({ identity, value: initial, origin: "server" as "server" | "restored" | "edited" });
  const value = draft.identity === identity ? draft.value : initial;
  const restored = draft.identity === identity && draft.origin === "restored";
  const ready = useRef<string | null>(null);
  const accepted = useRef(base);

  useEffect(() => {
    let cancelled = false;
    ready.current = null;
    queueMicrotask(() => {
      if (cancelled) return;
      accepted.current = base;
      let nextValue = JSON.parse(base) as T;
      let nextRestored = false;
      try {
        const candidate = readDraft(localStorage.getItem(key), base);
        const parsed = schema.safeParse(candidate);
        if (candidate !== undefined && parsed.success) {
          nextValue = parsed.data;
          nextRestored = true;
        } else {
          localStorage.removeItem(key);
        }
      } catch { /* Storage may be disabled; form editing still works. */ }
      // A user can edit before restoration's microtask. Never replace that newer work.
      setDraft((current) => current.identity === identity && current.origin === "edited"
        ? { ...current }
        : { identity, value: nextValue, origin: nextRestored ? "restored" : "server" });
      ready.current = identity;
    });
    return () => { cancelled = true; };
  }, [key, base, identity, schema]);

  useEffect(() => {
    if (ready.current !== identity) return;
    try {
      if (JSON.stringify(value) === accepted.current) localStorage.removeItem(key);
      else localStorage.setItem(key, encodeDraft(base, value));
    } catch { /* Storage full or unavailable. */ }
  }, [key, base, identity, value, draft]);

  const setValue = useCallback((next: SetStateAction<T>) => {
    setDraft((current) => {
      const previous = current.identity === identity ? current.value : JSON.parse(base) as T;
      return { identity, value: typeof next === "function" ? (next as (value: T) => T)(previous) : next, origin: "edited" };
    });
  }, [identity, base]);

  const clear = useCallback(() => {
    accepted.current = JSON.stringify(value);
    try { localStorage.removeItem(key); } catch { /* Storage unavailable. */ }
    setDraft((current) => ({ ...current, origin: "server" }));
  }, [key, value]);

  return { value, setValue, restored, clear };
}
