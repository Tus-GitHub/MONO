"use client";

import { useEffect } from "react";

/**
 * Catches a failure in the root layout itself — the one place the app shell / providers aren't
 * available, so this renders its own <html>/<body> with inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f5f1ea",
          color: "#211c17",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          MONO ran into a problem
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#766c60", margin: 0, maxWidth: "24rem" }}>
          Reloading usually fixes it. If it keeps happening, check your connection and try again
          in a minute.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #d6ccbb",
            background: "#fdfbf7",
            color: "#211c17",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
