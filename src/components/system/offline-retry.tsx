"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * "Try again" for the offline fallback page. Reloads on click, and reloads automatically when
 * the connection *comes back* (the `online` event — not merely `navigator.onLine`, which can
 * be true without real connectivity) so the real page can take over.
 */
export function OfflineRetry() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    const onBack = () => window.location.reload();
    window.addEventListener("online", onBack);
    return () => window.removeEventListener("online", onBack);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-fg"
      style={{
        marginTop: "0.5rem",
        height: "2.75rem",
        padding: "0 1.25rem",
        borderRadius: "0.5rem",
        background: "#b45a41",
        color: "#fdfbf7",
        border: "none",
        fontSize: "0.875rem",
      }}
    >
      {online ? "Try again" : "Waiting for a connection…"}
    </button>
  );
}
