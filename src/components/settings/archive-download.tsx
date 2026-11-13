"use client";

import { useAsyncTask } from "@/lib/hooks/use-async-task";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { settingsRequestError } from "@/lib/settings/request";

export function ArchiveDownload() {
  const task = useAsyncTask<Blob, "download">();
  const pending = task.state.status === "pending";
  const error = task.state.status === "error" ? task.state.message : null;
  const message = task.state.status === "success" ? "Your archive is ready to save. Keep it somewhere private." : null;

  async function download() {
    const outcome = await task.run("download", async (signal) => {
      const response = await fetch("/api/archive", { cache: "no-store", credentials: "same-origin", signal });
      if (!response.ok) throw await settingsRequestError(response);
      return response.blob();
    });
    if (!outcome) return;
    const url = URL.createObjectURL(outcome.data);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `mono-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
