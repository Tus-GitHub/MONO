"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { focusRing } from "@/components/ui/_shared";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mono:install-dismissed";
const INSTALLED_KEY = "mono:pwa-installed";
const SNOOZE_DAYS = 14;
const MAX_NUDGES = 3;

/* ---- install environment, read through a store so SSR and hydration stay consistent ---- */

interface Env {
  standalone: boolean;
  ios: boolean;
  installed: boolean;
  snoozed: boolean;
  nudges: number;
}
const SERVER_ENV: Env = {
  standalone: true, // assume installed on the server → render nothing until the client says otherwise
  ios: false,
  installed: true,
  snoozed: true,
  nudges: MAX_NUDGES,
};
let cache: Env | null = null;

function readEnv(): Env {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const ios =
    /ipad|iphone|ipod/i.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  let installed = false;
  let snoozed = false;
  let nudges = 0;
  try {
    installed = localStorage.getItem(INSTALLED_KEY) === "1";
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as { at: number; count: number };
      nudges = d.count ?? 0;
      snoozed = Date.now() - (d.at ?? 0) < SNOOZE_DAYS * 86_400_000;
    }
  } catch {
    /* storage unavailable — treat as never nudged */
  }
  if (
    cache &&
    cache.standalone === standalone &&
    cache.ios === ios &&
    cache.installed === installed &&
    cache.snoozed === snoozed &&
    cache.nudges === nudges
  ) {
    return cache;
  }
  cache = { standalone, ios, installed, snoozed, nudges };
  return cache;
}
function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onChange);
  window.addEventListener("mono:install-state", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("mono:install-state", onChange);
  };
}

/**
 * Unobtrusive "add MONO to your home screen".
 *
 *   variant="banner"  a slim, dismissible strip — used once on Home, then snoozed ~2 weeks
 *                     and shown at most a few times ever.
 *   variant="card"    an always-available panel in Settings for people who go looking.
 *
 * Renders nothing when MONO is already installed / running standalone, or when there is no
 * install path on this browser (e.g. desktop Firefox).
 */
export function InstallPrompt({ variant = "banner" }: { variant?: "banner" | "card" }) {
  const env = useSyncExternalStore(subscribe, readEnv, () => SERVER_ENV);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);

  useEffect(() => {
    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event("mono:install-state"));
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const snooze = useCallback(() => {
    setDismissedNow(true);
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const prev = raw ? (JSON.parse(raw) as { count: number }) : { count: 0 };
      localStorage.setItem(
        DISMISS_KEY,
        JSON.stringify({ at: Date.now(), count: (prev.count ?? 0) + 1 }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
  }, [deferred]);

  const { standalone, ios, installed, snoozed, nudges } = env;
  if (standalone || installed || dismissedNow) return null;
  if (!deferred && !ios) return null; // nothing actionable here
  if (variant === "banner" && (snoozed || nudges >= MAX_NUDGES)) return null;

  if (variant === "card") {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
            <Icon name="sparkles" size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Install MONO</p>
            {ios ? (
              <p className="mt-0.5 text-sm text-muted">
                In Safari, tap the Share button{" "}
                <Icon name="share" size={14} className="-mt-0.5 inline text-muted" /> then{" "}
                <span className="font-medium text-ink">Add to Home Screen</span>. It opens
                straight into MONO, full screen.
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted">
                Add MONO to your home screen for a full-screen, app-like space that opens in
                one tap.
              </p>
            )}
            {deferred ? (
              <button
                type="button"
                onClick={install}
                className={cn(
                  "mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover",
                  focusRing,
                )}
              >
                <Icon name="plus" size="sm" />
                Add to home screen
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary-tint/50 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-fg">
        <Icon name="sparkles" size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Keep MONO one tap away</p>
        <p className="text-xs text-muted">
          {ios
            ? "Share → Add to Home Screen for the full-screen app."
            : "Add it to your home screen — it opens like an app."}
        </p>
      </div>
      {deferred ? (
        <button
          type="button"
          onClick={install}
          className={cn(
            "h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover",
            focusRing,
          )}
        >
          Add
        </button>
      ) : null}
      <button
        type="button"
        onClick={snooze}
        aria-label="Dismiss"
        className={cn(
          "tap grid shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink",
          focusRing,
        )}
      >
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}
