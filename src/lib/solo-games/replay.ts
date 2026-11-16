import { advanceSoloRound, createSoloRound, type SoloRound } from "./engine";
import { MAX_SOLO_FRAMES, SOLO_RULES_VERSION, type SoloKind, type SoloReplay, type SoloRulesVersion } from "./catalog";

/** Recompute the score, never accept a client-supplied total. Checkpoints may be unfinished. */
export function restoreSoloRound(kind: SoloKind, seed: number, replay: SoloReplay, rulesVersion: SoloRulesVersion = SOLO_RULES_VERSION): SoloRound {
  const { frames, moves } = replay;
  if (!Number.isInteger(frames) || frames < 0 || frames > MAX_SOLO_FRAMES || moves.length > MAX_SOLO_FRAMES) throw new Error("Invalid round length.");
  let previous = -1;
  for (const [frame, value] of moves) {
    if (!Number.isInteger(frame) || frame <= previous || frame >= frames || !Number.isInteger(value) || value < 0 || value > (kind === "EMOJI_BOUNCE" ? 360 : 3)) throw new Error("Invalid game controls.");
    previous = frame;
  }
  if (kind === "MERGE_2048" && moves.length !== frames) throw new Error("Incomplete round.");
  let round = createSoloRound(kind, seed, rulesVersion), index = 0, input = kind === "EMOJI_BOUNCE" ? 180 : 1;
  for (let frame = 0; frame < frames; frame++) {
    if (round.state.over) throw new Error("This round already ended.");
    if (moves[index]?.[0] === frame) input = moves[index++][1];
    const next = advanceSoloRound(round, input);
    if (next === round) throw new Error("Invalid tile move.");
    round = next;
  }
  return round;
}

export function replaySolo(kind: SoloKind, seed: number, replay: SoloReplay, rulesVersion: SoloRulesVersion = SOLO_RULES_VERSION): number {
  return restoreSoloRound(kind, seed, replay, rulesVersion).state.score;
}
