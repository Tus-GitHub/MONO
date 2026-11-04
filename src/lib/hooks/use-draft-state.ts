"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { encodeDraft, readDraft } from "@/lib/utils/draft";

/** Validated, versioned device drafts. Callers scope private values by user and resource. */
export function useDraftState<T>(key: string, initial: T, schema: z.ZodType<T>) {
  const [value, setValue] = useState(initial);
  const [restored, setRestored] = useState(false);
  const base = JSON.stringify(initial);
  const ready = useRef<string | null>(null);
  const accepted = useRef(base);
  const identity = `${key}:${base}`;

  useEffect(() => {
    let cancelled = false;
    ready.current = null;
    queueMicrotask(() => {
      if (cancelled) return;
      accepted.current = base;
      try {
        const candidate = readDraft(localStorage.getItem(key), base);
        const parsed = schema.safeParse(candidate);
        if (candidate !== undefined && parsed.success) {
          setValue(parsed.data);
          setRestored(true);
        } else {
          localStorage.removeItem(key);
          setValue(JSON.parse(base) as T);
          setRestored(false);
        }
      } catch { /* Storage may be disabled; form editing still works. */ }
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
  }, [key, base, identity, value]);

  const clear = useCallback(() => {
    accepted.current = JSON.stringify(value);
    try { localStorage.removeItem(key); } catch { /* Storage unavailable. */ }
    setRestored(false);
  }, [key, value]);

  return { value, setValue, restored, clear };
}
