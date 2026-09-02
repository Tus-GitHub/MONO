"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { cn } from "@/lib/utils/cn";

/**
 * A slim status strip pinned to the top of the viewport. Shows while the browser is offline,
 * then flashes "Back online" briefly when the connection returns. Purely informational — it
 * never claims anything was saved.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [online]);

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium",
        "pt-[max(0.5rem,env(safe-area-inset-top))]",
        online
          ? "bg-success text-primary-fg"
          : "bg-ink text-paper",
      )}
    >
      <Icon name={online ? "checkCircle" : "alertCircle"} size={14} />
      {online
        ? "Back online."
        : "You're offline. Anything you change won't be saved until you reconnect."}
    </div>
  );
}
