import type { Metadata } from "next";

import { OfflineRetry } from "@/components/system/offline-retry";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails with no network. Deliberately tiny and
 * self-contained — no data, no auth — so it works from cache alone. Inline styles cover the
 * case where the hashed stylesheet isn't cached yet; the design tokens take over when it is.
 */
export default function OfflinePage() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink"
      style={{ minHeight: "100dvh", padding: "1.5rem" }}
    >
      <svg
        viewBox="0 0 32 32"
        width="56"
        height="56"
        fill="none"
        aria-hidden="true"
        style={{ opacity: 0.9 }}
      >
        <circle cx="12.75" cy="16" r="7.75" stroke="#b45a41" strokeWidth="2.25" />
        <circle cx="19.25" cy="16" r="7.75" fill="#b45a41" opacity="0.5" />
      </svg>
      <h1 className="font-display text-xl font-medium" style={{ fontSize: "1.25rem", margin: 0 }}>
        You&rsquo;re offline
      </h1>
      <p className="max-w-xs text-sm text-muted" style={{ maxWidth: "20rem", color: "#766c60" }}>
        MONO needs a connection for this. Your unsent notes are kept on this device — reconnect
        and try again.
      </p>
      <OfflineRetry />
    </main>
  );
}
