import { expect, it } from "vitest";
import { advanceSoloRound, createSoloRound } from "./engine";
import { restoreSoloRound } from "./replay";
import { acknowledgeSoloDraft, checkpointSoloDraft, emptySoloDraft, flushSoloDraft, readSoloDraft, soloDraftBest, soloDraftKey, writeSoloDraft, type SoloCheckpoint, type SoloStorage } from "./recovery";
import { newBounce } from "./emoji-bounce";

function storage(): SoloStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function checkpoint(frames: number, rulesVersion: 1 | 2 = 2): SoloCheckpoint {
  const challenge = { kind: "EMOJI_BOUNCE" as const, seed: 17, token: "signed-test-round", rulesVersion };
  let round = createSoloRound(challenge.kind, challenge.seed, rulesVersion);
  const moves: [number, number][] = [];
  for (let i = 0; i < frames && !round.state.over; i++) {
    const x = round.kind === "EMOJI_BOUNCE" ? Math.round(round.state.x) : 180;
    moves.push([i, x]); round = advanceSoloRound(round, x);
  }
  return { challenge, replay: { frames: round.state.frame, moves }, score: round.state.score, savedAt: frames };
}
const key = soloDraftKey("couple", "player", "EMOJI_BOUNCE");
it("retains a failed save across reload and restores the exact round before retrying", async () => {
  const disk = storage(), item = checkpoint(900);
  expect(item.score).toBeGreaterThan(0);
  writeSoloDraft(disk, key, checkpointSoloDraft(emptySoloDraft(), item));
  await expect(flushSoloDraft(disk, key, "EMOJI_BOUNCE", async () => { throw new TypeError("Failed to fetch"); })).rejects.toThrow();
  const reloaded = readSoloDraft(disk, key, "EMOJI_BOUNCE");
  expect(reloaded.pending).toEqual(item); expect(soloDraftBest(reloaded)).toBe(item.score);
  const restored = restoreSoloRound(item.challenge.kind, item.challenge.seed, reloaded.round!.replay, 2);
  const expected = restoreSoloRound(item.challenge.kind, item.challenge.seed, item.replay, 2);
  expect(restored).toEqual(expected);
  expect(advanceSoloRound(restored, 150)).toEqual(advanceSoloRound(expected, 150));
  await flushSoloDraft(disk, key, "EMOJI_BOUNCE", async proof => ({ bestScore: proof.score }));
  const saved = readSoloDraft(disk, key, "EMOJI_BOUNCE");
  expect(saved.pending).toBeNull(); expect(saved.confirmedBest).toBe(item.score); expect(saved.round).toEqual(item);
});
it("does not lose a higher score recorded while an earlier request is in flight", async () => {
  const disk = storage(), lower = checkpoint(300), higher = checkpoint(1500);
  writeSoloDraft(disk, key, checkpointSoloDraft(emptySoloDraft(), lower));
  let acknowledge!: (value: { bestScore: number }) => void;
  const saving = flushSoloDraft(disk, key, "EMOJI_BOUNCE", () => new Promise(resolve => { acknowledge = resolve; }));
  writeSoloDraft(disk, key, checkpointSoloDraft(readSoloDraft(disk, key, "EMOJI_BOUNCE"), higher));
  acknowledge({ bestScore: lower.score }); await saving;
  const waiting = readSoloDraft(disk, key, "EMOJI_BOUNCE");
  expect(waiting.pending).toEqual(higher); expect(waiting.round).toEqual(higher);
  const confirmed = acknowledgeSoloDraft(waiting, higher.score);
  const restarted = checkpointSoloDraft(confirmed, checkpoint(0));
  expect(restarted.pending).toBeNull(); expect(soloDraftBest(restarted)).toBe(higher.score);
});
it("scopes backups to the account, couple and game and ignores damaged storage", () => {
  const disk = storage(); writeSoloDraft(disk, key, checkpointSoloDraft(emptySoloDraft(), checkpoint(600)));
  for (const other of [soloDraftKey("other", "player", "EMOJI_BOUNCE"), soloDraftKey("couple", "partner", "EMOJI_BOUNCE"), soloDraftKey("couple", "player", "SNAKE")]) expect(readSoloDraft(disk, other, "EMOJI_BOUNCE")).toEqual(emptySoloDraft());
  expect(readSoloDraft(disk, key, "SNAKE")).toEqual(emptySoloDraft());
  disk.setItem(key, "{broken"); expect(readSoloDraft(disk, key, "EMOJI_BOUNCE")).toEqual(emptySoloDraft());
  const forged = checkpointSoloDraft(emptySoloDraft(), { ...checkpoint(600), score: 999 });
  writeSoloDraft(disk, key, forged); expect(readSoloDraft(disk, key, "EMOJI_BOUNCE")).toEqual(emptySoloDraft());
  expect(writeSoloDraft({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, key, emptySoloDraft())).toBe(false);
});
it("uses 12% faster new physics while retaining old round recovery", () => {
  const old = newBounce(1, 1), fast = newBounce(1, 2);
  expect(fast.vx / old.vx).toBeCloseTo(1.12); expect(fast.vy / old.vy).toBeCloseTo(1.12);
  for (const version of [1, 2] as const) {
    const item = checkpoint(1200, version), disk = storage();
    writeSoloDraft(disk, key, checkpointSoloDraft(emptySoloDraft(), item));
    expect(readSoloDraft(disk, key, "EMOJI_BOUNCE").round?.score).toBe(item.score);
  }
});
