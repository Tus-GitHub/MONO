"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { savePushSubscriptionAction } from "@/server/actions/reminders";
import { TaskScope } from "@/lib/state/task";
import { waitFor } from "@/lib/state/wait-for";
import { idleState } from "@/lib/utils/result";
import { requestNotificationPermission, notificationSetupError } from "@/lib/notifications/browser-permission";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State =
  | "loading"
  | "unsupported" // no Notification / ServiceWorker / PushManager
  | "not-configured" // this deployment has no VAPID keys
  | "ios-needs-install" // iOS Safari, not yet added to the home screen
  | "denied"
  | "off" // supported + permitted-or-undecided, not subscribed
  | "on"
  | "enabling"
  | "disabling";

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
export function EnableBrowserNotifications({ purpose = "reminders" }: { purpose?: "reminders" | "calls" }) {
  const { toast } = useToast();
  const [state, setState] = useState<State>("loading");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [revision, setRevision] = useState(0);
  const scope = useRef(new TaskScope());
  const busy = state === "enabling" || state === "disabling";
  const displayState = state === "enabling" ? "off" : state === "disabling" ? "on" : state;

  useEffect(() => {
    const owner = scope.current;
    const signal = owner.begin(true)!;
    void (async () => {
      const supported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      if (!supported) {
        if (!signal.aborted) setState(isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        if (!signal.aborted) setState("not-configured");
        return;
      }
      if (Notification.permission === "denied") {
        if (!signal.aborted) setState("denied");
        return;
      }
      const reg = await waitFor(navigator.serviceWorker.ready, signal).catch(() => null);
      const sub = reg ? await waitFor(reg.pushManager.getSubscription(), signal) : null;
      if (signal.aborted) return;
      if (sub && !signal.aborted) {
        const fd = new FormData();
        fd.set("subscription", JSON.stringify(sub.toJSON()));
        const result = await waitFor(savePushSubscriptionAction(idleState, fd), signal).catch(() => null);
        if (result?.status !== "success") {
          if (!signal.aborted) setState("off");
          return;
        }
      }
      if (!signal.aborted) setState(sub ? "on" : "off");
    })().catch(() => { if (!signal.aborted) setState("off"); }).finally(() => { owner.finish(signal); });
    return () => owner.cancel();
  }, [revision]);

  const enable = async () => {
    const signal = scope.current.begin();
    if (!signal || state !== "off") { if (signal) scope.current.finish(signal); return; }
    setState("enabling");
    setFeedback(null); setProgress("Waiting for notification permission…");
    let stage: "permission" | "device" | "save" = "permission";
    try {
      const permission = await requestNotificationPermission(signal);
      signal.throwIfAborted();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        setFeedback(permission === "denied" ? "Allow MONO in your browser and phone notification settings, then tap Check again." : "Permission wasn't granted. Check the notification icon beside your browser's address bar, then try again.");
        return;
      }
      stage = "device"; setProgress("Registering this device…");
      const reg = await waitFor(navigator.serviceWorker.ready, signal);
      const sub =
        (await waitFor(reg.pushManager.getSubscription(), signal)) ??
        (await waitFor(reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }), signal, 20_000));
      signal.throwIfAborted();
      stage = "save"; setProgress("Saving notification settings…");
      const fd = new FormData();
      fd.set("subscription", JSON.stringify(sub.toJSON()));
      const result = await waitFor(savePushSubscriptionAction(idleState, fd), signal);
      if (signal.aborted) return;
      if (result.status === "error") {
        setFeedback(result.message ?? "Couldn't save notification settings. Try again.");
        setState("off");
        return;
      }
      setState("on");
      toast({ title: "Notifications enabled on this device.", variant: "success" });
    } catch (error) {
      if (signal.aborted) return;
      setFeedback(notificationSetupError(stage, error));
      setState("off");
    } finally {
      if (!signal.aborted) setProgress("");
      scope.current.finish(signal);
    }
  };

  const disable = async () => {
    const signal = scope.current.begin();
    if (!signal || state !== "on") { if (signal) scope.current.finish(signal); return; }
    setState("disabling");
    try {
      const reg = await waitFor(navigator.serviceWorker.ready, signal);
      const sub = await reg.pushManager.getSubscription();
      signal.throwIfAborted();
      const fd = new FormData();
      fd.set("subscription", "null");
      if (sub) fd.set("endpoint", sub.endpoint);
      const result = await savePushSubscriptionAction(idleState, fd);
      if (signal.aborted) return;
      if (result.status === "error") {
        toast({ title: result.message, variant: "error" });
        setState("on");
        return;
      }
      await sub?.unsubscribe().catch(() => undefined);
      if (signal.aborted) return;
      setState("off");
      toast({ title: "Browser reminders off." });
    } catch {
      if (signal.aborted) return;
      setState("on");
      toast({ title: "Couldn't turn off reminders. Try again.", variant: "error" });
    } finally {
      scope.current.finish(signal);
    }
  };

  const message: Record<Exclude<State, "enabling" | "disabling">, string> = {
    loading: "…",
    unsupported: "This browser can't show reminders — you'll still see everything inside MONO.",
    "not-configured": "Browser reminders aren't set up for this install. In-app notifications still work.",
    "ios-needs-install":
      "On iPhone, add MONO to your Home Screen first — then you can turn on reminders here.",
    denied: "Notifications are blocked in your browser settings. Re-enable them there to use this.",
    off: purpose === "calls" ? "Allow notifications for incoming calls, even when MONO is closed. Tap the alert to open MONO and answer." : "Want MONO to remind you about your next date, and when your partner adds something — even when MONO is closed?",
    on: "Enabled on this device. Delivery depends on your connection and phone notification settings.",
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
          <Icon name="bell" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{purpose === "calls" ? "Incoming-call notifications" : "Notifications when MONO is closed"}</p>
          <p className="mt-0.5 text-sm text-muted">{message[displayState]}</p>
          {progress ? <p role="status" className="mt-2 text-sm text-muted">{progress}</p> : null}
          {feedback ? <p role="alert" className="mt-2 text-sm text-error">{feedback}</p> : null}
          {displayState === "denied" || displayState === "unsupported" ? <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setFeedback(null); setState("loading"); setRevision((value) => value + 1); }}>Check again</Button> : null}
          {displayState === "off" ? (
            <Button size="sm" variant="secondary" className="mt-3" loading={busy} onClick={enable}>
              Enable notifications
            </Button>
          ) : null}
          {displayState === "on" ? (
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" className="mt-3" onClick={() => {
              void navigator.serviceWorker.ready.then((reg) => reg.showNotification("MONO test notification", { body: "Popups are enabled. Incoming-call alerts open MONO to answer.", icon: "/icons/icon-192.png", tag: "mono_popup_test", data: { url: "/chat" } }))
                .catch(() => toast({ title: "Couldn't show the popup. Check this device's notification settings.", variant: "error" }));
            }}>Test notification popup</Button><Button size="sm" variant="ghost" className="mt-3" loading={busy} onClick={disable}>
              Turn off
            </Button></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
