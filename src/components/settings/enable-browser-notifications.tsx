"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Permission = "default" | "granted" | "denied" | "unsupported";

function currentPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Permission;
}

/**
 * Requests browser notification permission. Actual push delivery is handled by whichever
 * provider is wired into `src/lib/notifications/push.ts` — this component only manages
 * consent and reports readiness.
 */
export function EnableBrowserNotifications() {
  const [permission, setPermission] = useState<Permission>(currentPermission);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    if (permission === "unsupported") return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
          <Icon name="bell" size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Browser notifications</p>
          <p className="mt-0.5 text-sm text-muted">
            {permission === "unsupported"
              ? "This browser doesn't support notifications."
              : permission === "granted"
                ? "Allowed. Reminders will arrive here once a push provider is connected."
                : permission === "denied"
                  ? "Blocked in your browser settings."
                  : "Get a nudge before a date, even when MONO isn't open."}
          </p>
          {permission === "default" ? (
            <Button size="sm" variant="secondary" className="mt-3" loading={busy} onClick={request}>
              Allow notifications
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
