"use client";
import { useEffect, useState } from "react";
import { SOLO_GAMES, SOLO_KINDS, type SoloKind } from "@/lib/solo-games/catalog";
import { flushSoloDraft, readSoloDraft, soloDraftKey, soloStorage } from "@/lib/solo-games/recovery";
import { togetherFetch } from "@/lib/together/client";

/** Retry device-backed results even when the player returns to the catalog or Scores. */
export function SoloScoreRecovery({ coupleId, userId, onSaved }: { coupleId: string; userId: string; onSaved: () => Promise<void> }) {
  const [pending, setPending] = useState<{ kind: SoloKind; score: number }[]>([]);
  useEffect(() => {
    const storage = soloStorage();
    if (!storage) return;
    const keys = SOLO_KINDS.map(kind => ({ kind, key: soloDraftKey(coupleId, userId, kind) }));
    let disposed = false, busy = false, hasPending = true;
    const collect = () => keys.flatMap(({ kind, key }) => {
      const item = readSoloDraft(storage, key, kind).pending;
      return item ? [{ kind, score: item.score }] : [];
    });
    const sync = async () => {
      if (busy || !hasPending) return;
      const items = collect(); hasPending = items.length > 0; setPending(items);
      if (!hasPending || !navigator.onLine) return;
      busy = true; let changed = false;
      try {
        for (const { kind, key } of keys) {
          if (disposed) return;
          try {
            changed = await flushSoloDraft(storage, key, kind, item => togetherFetch<{ bestScore: number }>("/api/together/solo", { body: { action: "save", token: item.challenge.token, ...item.replay } })) || changed;
          } catch { /* Keep the backup and retry after connectivity recovers. */ }
        }
        if (!disposed) { const remaining = collect(); hasPending = remaining.length > 0; setPending(remaining); if (changed) await onSaved(); }
      } catch { /* A failed catalog refresh must not discard saved results. */
      } finally { busy = false; }
    };
    const retry = () => { hasPending = true; void sync(); };
    const changed = (event: StorageEvent) => { if (keys.some(item => item.key === event.key)) retry(); };
    void sync(); const timer = setInterval(() => { if (!document.hidden) void sync(); }, 10_000);
    window.addEventListener("online", retry); window.addEventListener("storage", changed);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener("online", retry); window.removeEventListener("storage", changed); };
  }, [coupleId, userId, onSaved]);
  return pending.length ? <p role="status" className="text-sm text-muted">Saved on this device, waiting to sync: {pending.map(item => `${SOLO_GAMES[item.kind].name} ${item.score.toLocaleString()}`).join(" · ")}.</p> : null;
}
