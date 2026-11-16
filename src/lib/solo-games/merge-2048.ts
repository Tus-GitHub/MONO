import { MAX_SOLO_FRAMES, nextRandom, type Direction } from "./catalog";
export interface MergeState { board: number[]; seed: number; score: number; frame: number; over: boolean }
function spawn(board: number[], seed: number): number {
  const empty = board.flatMap((value, i) => value === 0 ? [i] : []);
  if (!empty.length) return seed;
  seed = nextRandom(seed); const index = empty[Math.floor(seed / 2 ** 32 * empty.length)];
  seed = nextRandom(seed); board[index] = seed / 2 ** 32 < 0.1 ? 4 : 2;
  return seed;
}
export function newMerge(seed: number): MergeState {
  const board = Array<number>(16).fill(0);
  seed = spawn(board, seed); seed = spawn(board, seed);
  return { board, seed, score: 0, frame: 0, over: false };
}
export function canMergeMove(board: number[]): boolean {
  return board.some((n, i) => n === 0 || (i % 4 < 3 && n === board[i + 1]) || (i < 12 && n === board[i + 4]));
}
export function stepMerge(current: MergeState, direction: Direction): MergeState {
  if (current.over) return current;
  const board = [...current.board]; let score = current.score;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, n) => direction === 0 ? n * 4 + line : direction === 1 ? line * 4 + 3 - n : direction === 2 ? (3 - n) * 4 + line : line * 4 + n);
    const values = indices.map(i => current.board[i]).filter(Boolean), merged: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) { const n = values[i] * 2; merged.push(n); score += n; i++; }
      else merged.push(values[i]);
    }
    indices.forEach((index, n) => { board[index] = merged[n] ?? 0; });
  }
  if (board.every((n, i) => n === current.board[i])) return current;
  const seed = spawn(board, current.seed), frame = current.frame + 1;
  return { board, seed, score, frame, over: !canMergeMove(board) || frame >= MAX_SOLO_FRAMES };
}
