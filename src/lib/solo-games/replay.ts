import { newBounce, stepBounce } from "./emoji-bounce";
import { newSnake, stepSnake } from "./snake";
import { newMerge, stepMerge } from "./merge-2048";
import { MAX_SOLO_FRAMES, type SoloKind, type SoloReplay, type Direction } from "./catalog";

/** Recompute the score, never accept a client-supplied total. Checkpoints may be unfinished. */
export function replaySolo(kind: SoloKind, seed: number, replay: SoloReplay): number {
  const { frames, moves } = replay;
  if (!Number.isInteger(frames) || frames < 0 || frames > MAX_SOLO_FRAMES || moves.length > MAX_SOLO_FRAMES) throw new Error("Invalid round length.");
  let previous = -1;
  for (const [frame, value] of moves) {
    if (!Number.isInteger(frame) || frame <= previous || frame >= frames || !Number.isInteger(value) || value < 0 || value > (kind === "EMOJI_BOUNCE" ? 360 : 3)) throw new Error("Invalid game controls.");
    previous = frame;
  }
  if (kind === "MERGE_2048") {
    if (moves.length !== frames) throw new Error("Incomplete round.");
    let state = newMerge(seed);
    for (let i = 0; i < frames; i++) {
      if (moves[i][0] !== i || state.over) throw new Error("Invalid round.");
      const next = stepMerge(state, moves[i][1] as Direction);
      if (next === state) throw new Error("Invalid tile move.");
      state = next;
    }
    return state.score;
  }
  let index = 0, input = kind === "EMOJI_BOUNCE" ? 180 : 1;
  let bounce = newBounce(seed), snake = newSnake(seed);
  for (let frame = 0; frame < frames; frame++) {
    if (moves[index]?.[0] === frame) input = moves[index++][1];
    if (kind === "EMOJI_BOUNCE") { if (bounce.over) throw new Error("This round already ended."); bounce = stepBounce(bounce, input); }
    else { if (snake.over) throw new Error("This round already ended."); snake = stepSnake(snake, input as Direction); }
  }
  return kind === "EMOJI_BOUNCE" ? bounce.score : snake.score;
}
