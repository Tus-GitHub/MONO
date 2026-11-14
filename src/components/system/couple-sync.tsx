"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Lightweight visible-tab status checks; fetches do not occupy the Server Action queue. */
export function CoupleSync({ revision }: { revision: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false);
  useEffect(() => { refreshing.current = pending; }, [pending]);
  useEffect(() => {
    if (!/^\/(home|dates|memories|plan|couple|notifications)(\/|$)/.test(pathname)) return;
    let disposed = false, running = false, latest = revision, lastPoll = 0, lastRefresh = 0, lastTouch = 0;
    let controller: AbortController | undefined;
    let deadline: number | undefined;
    const apply = () => {
      if (disposed || latest === revision || refreshing.current || document.visibilityState !== "visible" || Date.now() - lastRefresh < 5_000 || Date.now() - lastTouch < 750) return;
      if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
        || document.querySelector('[role="dialog"], [data-uploading="true"], form fieldset:disabled')) return;
      lastRefresh = Date.now();
      startTransition(() => router.refresh());
    };
    const tick = async () => {
      apply();
      if (disposed || running || document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastPoll < 1_000) return;
      running = true; lastPoll = Date.now(); controller = new AbortController();
      deadline = window.setTimeout(() => controller?.abort(), 8_000);
      try {
        const response = await fetch("/api/couple/updates", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!disposed && data && typeof data === "object" && "revision" in data && typeof data.revision === "string") { latest = data.revision; apply(); }
      } catch { /* Offline or a temporary failure: retry on the next visible check. */ }
      finally { window.clearTimeout(deadline); running = false; }
    };
    const touch = () => { lastTouch = Date.now(); };
    const interval = window.setInterval(() => void tick(), 5_000);
    const initial = window.setTimeout(() => void tick(), 500);
    const resume = () => { void tick(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("pointerdown", touch, { passive: true });
    return () => {
      disposed = true; controller?.abort(); window.clearTimeout(deadline); window.clearTimeout(initial); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", resume); window.removeEventListener("online", resume); document.removeEventListener("pointerdown", touch);
    };
  }, [revision, pathname, router, startTransition]);
  return null;
}
