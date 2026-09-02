"use client";

import { useEffect, useState } from "react";

import { focusRing } from "@/components/ui/_shared";
import { cn } from "@/lib/utils/cn";

/**
 * Registers the service worker (production only) and surfaces a quiet "an update is ready"
 * bar when a newer worker is waiting. Clicking Refresh tells that worker to take over; the
 * resulting `controllerchange` reloads the page once onto the new version.
 *
 * Dev is left completely alone — no registration, so hot reload and fresh fetches are
 * unaffected.
 */
export function ServiceWorkerManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(reg.waiting ?? next);
            }
          });
        });
      })
      .catch(() => {
        /* registration is best-effort */
      });

    // Re-check for a new worker whenever the tab comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+var(--bottomnav-h)+0.75rem)] lg:pb-4"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line bg-elevated p-3 shadow-lg">
        <p className="min-w-0 flex-1 text-sm text-ink">MONO just updated.</p>
        <button
          type="button"
          onClick={() => waiting.postMessage("SKIP_WAITING")}
          className={cn(
            "h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover",
            focusRing,
          )}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
