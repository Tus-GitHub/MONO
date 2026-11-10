"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { settingsErrorMessage, settingsRequestError } from "@/lib/settings/request";

export function ArchiveDownload() {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/archive", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw await settingsRequestError(response);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `mono-archive-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      // Give browsers time to start saving before releasing the object URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("Your archive is ready to save. Keep it somewhere private.");
    } catch (failure) { setError(settingsErrorMessage(failure)); }
    finally { busy.current = false; setPending(false); }
  }

  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-5" aria-labelledby="archive-download-title">
      <div>
        <h2 id="archive-download-title" className="font-display text-lg font-medium text-ink">Download a portable archive</h2>
        <p className="mt-1 text-sm text-muted">
          Your active dates, memories, expenses, saved places and owned photos in one restorable file.
          Your partner&apos;s hidden reviews and drafts stay private. Deleted content is excluded.
        </p>
      </div>
      <p className="text-xs text-muted">Up to 64 MiB per file, including up to 32 MiB of photos. The file contains private content.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <Button variant="secondary" loading={pending} onClick={download}>{pending ? "Preparing archive…" : "Download archive"}</Button>
    </section>
  );
}
