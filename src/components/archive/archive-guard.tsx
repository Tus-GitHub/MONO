"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

/** Hide an open viewer when approval is revoked or cannot be revalidated. */
export function ArchiveGuard({ coupleId, children }: { coupleId: string; children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "allowed" | "locked">("checking");
  useEffect(() => {
    let live = true, busy = false;
    let controller: AbortController | null = null;
    const check = async () => {
      if (busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const response = await fetch(`/api/history-access/${coupleId}`, { cache: "no-store", signal: controller.signal });
        if (live) setStatus(!document.hidden && response.ok ? "allowed" : "locked");
      } catch { if (live) setStatus("locked"); }
      finally { clearTimeout(timeout); busy = false; }
    };
    const hide = () => { if (document.hidden) setStatus("checking"); else void check(); };
    const focus = () => void check();
    void check();
    const timer = setInterval(focus, 15000);
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", hide);
    return () => { live = false; controller?.abort(); clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", hide); };
  }, [coupleId]);
  return status === "allowed" ? children : <div role="status" className="space-y-3 rounded-xl border border-line bg-surface p-5"><p>{status === "checking" ? "Checking archive access…" : "Archive access is locked or could not be confirmed. Connect to the internet and check your request status."}</p><Link href="/history-access" className="text-primary underline">Back to access requests</Link></div>;
}
