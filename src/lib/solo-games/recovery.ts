import { z } from "zod";
import { soloKindSchema, soloReplaySchema, soloRulesVersionSchema } from "@/lib/validation/solo-games";
import { replaySolo } from "./replay";
import type { SoloChallenge, SoloKind, SoloReplay } from "./catalog";

export interface SoloCheckpoint { challenge: SoloChallenge; replay: SoloReplay; score: number; savedAt: number }
export interface SoloDraft { version: 1; confirmedBest: number; round: SoloCheckpoint | null; pending: SoloCheckpoint | null }
export type SoloStorage = Pick<Storage, "getItem" | "setItem">;
const checkpointSchema = z.object({
  challenge: z.object({ token: z.string().min(1).max(2048), seed: z.number().int().min(0).max(2 ** 32 - 1), kind: soloKindSchema, rulesVersion: soloRulesVersionSchema.optional() }),
  replay: soloReplaySchema, score: z.number().int().min(0).max(2 ** 31 - 1), savedAt: z.number().int().nonnegative(),
});
const draftSchema = z.object({ version: z.literal(1), confirmedBest: z.number().int().min(0).max(2 ** 31 - 1), round: checkpointSchema.nullable(), pending: checkpointSchema.nullable() });
export const emptySoloDraft = (): SoloDraft => ({ version: 1, confirmedBest: 0, round: null, pending: null });
export const soloDraftKey = (coupleId: string, userId: string, kind: SoloKind) => `amor:solo:v1:${encodeURIComponent(coupleId)}:${encodeURIComponent(userId)}:${kind}`;
export function soloStorage(): SoloStorage | null { try { return window.localStorage; } catch { return null; } }
export function readSoloDraft(storage: SoloStorage | null, key: string, kind: SoloKind): SoloDraft {
  try {
    const raw = storage?.getItem(key);
    if (!raw || raw.length > 1_500_000) return emptySoloDraft();
    const draft = draftSchema.parse(JSON.parse(raw));
    for (const item of [draft.round, draft.pending]) {
      if (item && (item.challenge.kind !== kind || item.score !== replaySolo(kind, item.challenge.seed, item.replay, item.challenge.rulesVersion ?? 1))) return emptySoloDraft();
    }
    return draft;
  } catch { return emptySoloDraft(); }
}
export function writeSoloDraft(storage: SoloStorage | null, key: string, draft: SoloDraft): boolean {
  try { if (!storage) return false; storage.setItem(key, JSON.stringify(draft)); return true; } catch { return false; }
}
export function checkpointSoloDraft(draft: SoloDraft, round: SoloCheckpoint): SoloDraft {
  const pending = round.score > draft.confirmedBest && round.score >= (draft.pending?.score ?? 0) ? round : draft.pending;
  return { ...draft, round, pending };
}
export function acknowledgeSoloDraft(draft: SoloDraft, bestScore: number): SoloDraft {
  const confirmedBest = Math.max(draft.confirmedBest, bestScore);
  return { ...draft, confirmedBest, pending: draft.pending && draft.pending.score > confirmedBest ? draft.pending : null };
}
export const soloDraftBest = (draft: SoloDraft) => Math.max(draft.confirmedBest, draft.pending?.score ?? 0, draft.round?.score ?? 0);

/** An acknowledgement must not erase a newer checkpoint or a higher pending score. */
export async function flushSoloDraft(storage: SoloStorage, key: string, kind: SoloKind, send: (item: SoloCheckpoint) => Promise<{ bestScore: number }>): Promise<boolean> {
  const item = readSoloDraft(storage, key, kind).pending;
  if (!item) return false;
  const result = await send(item);
  writeSoloDraft(storage, key, acknowledgeSoloDraft(readSoloDraft(storage, key, kind), result.bestScore));
  return true;
}
