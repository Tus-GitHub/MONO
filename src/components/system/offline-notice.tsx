"use client";

import { Icon } from "@/components/ui/icon";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

/**
 * Drop inside a form. Warns — honestly — that a submit will fail right now, without disabling
 * the button (the user can still try, and see the real error).
 */
export function OfflineNotice({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p
      role="status"
      className={
        "flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-tint/50 px-3 py-2 text-xs text-warning" +
        (className ? ` ${className}` : "")
      }
    >
      <Icon name="alertCircle" size={14} className="mt-0.5 shrink-0" />
      You&apos;re offline. Your work is kept on this device — send it once you&apos;re back
      online.
    </p>
  );
}
