"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { savePushSubscriptionAction } from "@/server/actions/reminders";
import { idleState } from "@/lib/utils/result";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State =
  | "loading"
  | "unsupported" // no Notification / ServiceWorker / PushManager
  | "not-configured" // this deployment has no VAPID keys
  | "ios-needs-install" // iOS Safari, not yet added to the home screen
  | "denied"
  | "off" // supported + permitted-or-undecided, not subscribed
  | "on"; // subscribed

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIOS(): boolean {
  return (
    /ipad|iphone|ipod/i.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Opt-in browser / PWA reminders. Explains the benefit first, then asks — never on load.
 * Degrades quietly where push can't work: no broken control, and in-app notifications keep
 * carrying everything.
 */
export function EnableBrowserNotifications() {
  const { toast } = useToast();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      if (!supported) {
        if (!cancelled) setState(isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        if (!cancelled) setState("not-configured");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!cancelled) setState(sub ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const fd = new FormData();
      fd.set("subscription", JSON.stringify(sub.toJSON()));
      const result = await savePushSubscriptionAction(idleState, fd);
      if (result.status === "error") {
        await sub.unsubscribe().catch(() => undefined);
        toast({ title: result.message ?? "Couldn't turn on reminders.", variant: "error" });
        setState("off");
        return;
      }
      setState("on");
      toast({ title: "Reminders on — even when MONO is closed.", variant: "success" });
    } catch {
      toast({ title: "Couldn't turn on reminders. Try again.", variant: "error" });
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe().catch(() => undefined);
      const fd = new FormData();
      fd.set("subscription", "null");
      await savePushSubscriptionAction(idleState, fd);
      setState("off");
      toast({ title: "Browser reminders off." });
    } finally {
      setBusy(false);
    }
  };

  const message: Record<State, string> = {
    loading: "…",
    unsupported: "This browser can't show reminders — you'll still see everything inside MONO.",
    "not-configured": "Browser reminders aren't set up for this install. In-app notifications still work.",
    "ios-needs-install":
      "On iPhone, add MONO to your Home Screen first — then you can turn on reminders here.",
    denied: "Notifications are blocked in your browser settings. Re-enable them there to use this.",
    off: "Want MONO to remind you about your next date, and when your partner adds something — even when MONO is closed?",
    on: "On. Reminders will reach you even when MONO isn't open.",
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
          <Icon name="bell" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Reminders when MONO is closed</p>
          <p className="mt-0.5 text-sm text-muted">{message[state]}</p>
          {state === "off" ? (
            <Button size="sm" variant="secondary" className="mt-3" loading={busy} onClick={enable}>
              Turn on reminders
            </Button>
          ) : null}
          {state === "on" ? (
            <Button size="sm" variant="ghost" className="mt-3" loading={busy} onClick={disable}>
              Turn off
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
