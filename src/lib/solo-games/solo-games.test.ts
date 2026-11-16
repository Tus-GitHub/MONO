import { describe, expect, it } from "vitest";
import { BOUNCE, newBounce, stepBounce } from "./emoji-bounce";
import { newSnake, stepSnake } from "./snake";
import { canMergeMove, newMerge, stepMerge } from "./merge-2048";
import { replaySolo } from "./replay";
import { MAX_SOLO_FRAMES, type Direction } from "./catalog";
import { soloActionSchema } from "@/lib/validation/solo-games";

describe("emoji paddle physics", () => {
  it("rebounds from both side walls and the roof without awarding points", () => {
    for (const state of [{ x: 14, vx: -220 }, { x: 346, vx: 220 }, { y: 14, vy: -220 }]) {
      const before = { ...newBounce(1), ...state }, after = stepBounce(before, 180);
      expect(after.over).toBe(false); expect(after.score).toBe(0);
      if (state.vx) expect(Math.sign(after.vx)).toBe(-Math.sign(state.vx)); else expect(after.vy).toBeGreaterThan(0);
    }
  });
  it("counts a swept paddle catch once and loses at the floor", () => {
    const hit = stepBounce({ ...newBounce(1), x: 180, y: BOUNCE.paddleY - BOUNCE.radius - 1, vy: 570 }, 180);
    expect(hit.score).toBe(1); expect(hit.vy).toBeLessThan(0); expect(stepBounce(hit, 180).score).toBe(1);
    const miss = stepBounce({ ...newBounce(1), x: 30, y: 505, vy: 300 }, 300);
    expect(miss.over).toBe(true); expect(miss.score).toBe(0); expect(stepBounce(miss, 180)).toBe(miss);
  });
  it("replays an actual controlled run with the same score", () => {
    let state = newBounce(7); const moves: [number, number][] = [];
    for (let i = 0; i < 2400 && !state.over; i++) { const x = Math.round(state.x); moves.push([i, x]); state = stepBounce(state, x); }
    expect(state.score).toBeGreaterThan(8);
    expect(replaySolo("EMOJI_BOUNCE", 7, { frames: state.frame, moves })).toBe(state.score);
  });
});
describe("snake rules", () => {
  it("grows on food, preserves direction on reversal and loses on walls/body", () => {
    const initial = newSnake(11), grown = stepSnake({ ...initial, food: initial.body[0] + 1 }, 1);
    expect(grown.score).toBe(10); expect(grown.body).toHaveLength(4); expect(grown.body).not.toContain(grown.food);
    expect(stepSnake(initial, 3).direction).toBe(1);
    expect(stepSnake({ ...initial, body: [17,16,15] }, 1).over).toBe(true);
    expect(stepSnake({ ...initial, body: [19,20,38,37,36], direction: 0 }, 1).over).toBe(true);
  });
  it("can enter the departing tail square when not eating", () => {
    const state = { ...newSnake(1), body: [19,20,38,37], direction: 3 as Direction, food: 300 };
    expect(stepSnake(state, 2).over).toBe(false);
  });
});
describe("2048 rules", () => {
  it("merges once per move and adds only the newly merged tile values", () => {
    const initial = { ...newMerge(1), board: [2,2,2,2,...Array(12).fill(0)] };
    const next = stepMerge(initial, 3);
    expect(next.board.slice(0,2)).toEqual([4,4]); expect(next.score).toBe(8);
    expect(initial.board.slice(0,4)).toEqual([2,2,2,2]);
  });
  it("does not spawn or score for a no-op and detects a full blocked board", () => {
    const state = { ...newMerge(2), board: [2,0,0,0,...Array(12).fill(0)] };
    expect(stepMerge(state, 3)).toBe(state);
    expect(canMergeMove([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2])).toBe(false);
  });
  it("replays long mixed-direction runs deterministically", () => {
    let state = newMerge(17); const moves: [number, number][] = [];
    for (let i = 0; i < 500 && !state.over; i++) {
      const direction = (i * 7 % 4) as Direction, next = stepMerge(state, direction);
      if (next !== state) { moves.push([state.frame, direction]); state = next; }
    }
    expect(state.score).toBeGreaterThan(100);
    expect(replaySolo("MERGE_2048", 17, { frames: state.frame, moves })).toBe(state.score);
  });
});
it("rejects forged, out-of-order, oversized and post-loss transcripts", () => {
  expect(soloActionSchema.safeParse({ action: "save", token: "x", frames: 0, moves: [], score: 99999 }).success).toBe(false);
  expect(() => replaySolo("SNAKE", 1, { frames: 2, moves: [[1,0],[0,1]] })).toThrow();
  expect(() => replaySolo("SNAKE", 1, { frames: 1, moves: [[0,4]] })).toThrow();
  expect(() => replaySolo("EMOJI_BOUNCE", 1, { frames: MAX_SOLO_FRAMES + 1, moves: [] })).toThrow();
  expect(() => replaySolo("SNAKE", 1, { frames: 50, moves: [] })).toThrow();
  expect(() => replaySolo("MERGE_2048", 1, { frames: 1, moves: [] })).toThrow();
});
