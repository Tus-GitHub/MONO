import { SOLO_RULES_VERSION, type Direction, type SoloKind, type SoloRulesVersion } from "./catalog";
import { newBounce, stepBounce, type BounceState } from "./emoji-bounce";
import { newSnake, stepSnake, type SnakeState } from "./snake";
import { newMerge, stepMerge, type MergeState } from "./merge-2048";
export type SoloRound = { kind: "EMOJI_BOUNCE"; state: BounceState } | { kind: "SNAKE"; state: SnakeState } | { kind: "MERGE_2048"; state: MergeState };
export function createSoloRound(kind: SoloKind, seed: number, rulesVersion: SoloRulesVersion = SOLO_RULES_VERSION): SoloRound {
  return kind === "EMOJI_BOUNCE" ? { kind, state: newBounce(seed, rulesVersion) } : kind === "SNAKE" ? { kind, state: newSnake(seed) } : { kind, state: newMerge(seed) };
}
export function advanceSoloRound(round: SoloRound, input: number): SoloRound {
  if (round.kind === "EMOJI_BOUNCE") return { kind: round.kind, state: stepBounce(round.state, input) };
  if (round.kind === "SNAKE") return { kind: round.kind, state: stepSnake(round.state, input as Direction) };
  const state = stepMerge(round.state, input as Direction);
  return state === round.state ? round : { kind: round.kind, state };
}
