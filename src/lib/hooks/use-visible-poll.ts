"use client";
import { useEffect, useRef } from "react";

/** One request at a time, paused in hidden tabs, with immediate recovery on visibility. */
export function useVisiblePoll(work: (signal: AbortSignal) => Promise<void>, delay: number, enabled = true, inBackground = false) {
  const callback = useRef(work);
  const interval = useRef(delay);
  useEffect(() => { callback.current = work; }, [work]);
  useEffect(() => { interval.current = delay; }, [delay]);
  useEffect(() => {
    if (!enabled) return;
    let closed = false, generation = 0, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    const run = async () => {
      clearTimeout(timer);
      if (closed || (document.hidden && !inBackground)) return;
      const runId = ++generation;
      controller?.abort(); controller = new AbortController();
      try { await callback.current(controller.signal); } catch { /* The caller owns visible error feedback. */ }
      if (!closed && generation === runId) timer = setTimeout(run, interval.current);
    };
    const visible = () => { if (!document.hidden) { void run(); } else if (!inBackground) { generation++; clearTimeout(timer); controller?.abort(); } };
    document.addEventListener("visibilitychange", visible);
    void run();
    return () => { closed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [enabled, inBackground]);
}
