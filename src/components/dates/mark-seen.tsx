"use client";

import { useEffect } from "react";

/** Fire-and-forget: records that this member has looked at the couple's date activity. */
export function MarkDatesSeen() {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/activity/seen", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return null;
}
