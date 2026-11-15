import { expect, it } from "vitest";
import { newGame } from "./games";
import type { GameDTO } from "./types";
import { mergeGameHistory, recentGames, RECENT_GAME_WINDOW_MS } from "./game-list";

const now = "2026-11-16T09:00:00.000Z";
const game = (id: string, activity: number, createdAt = "2026-11-15T09:00:00.000Z"): GameDTO => ({
  id, kind: "TIC_TAC_TOE", status: "ACTIVE", playerOneId: "a", playerTwoId: "b", winnerId: null,
  state: newGame("TIC_TAC_TOE", () => 0), version: 1, createdAt, updatedAt: new Date(Date.parse(now) - activity).toISOString(),
});

it("uses the last activity hour, including a match started earlier, and excludes expired matches", () => {
  const active = game("active", 0), boundary = game("boundary", RECENT_GAME_WINDOW_MS), old = game("old", RECENT_GAME_WINDOW_MS + 1);
  expect(recentGames([old, boundary, active], now).map((row) => row.id)).toEqual(["active", "boundary"]);
  expect(recentGames([boundary], "2026-11-16T09:00:00.001Z")).toEqual([]);
});

it("keeps history once per match, ordered by start, without replacing a newer board", () => {
  const first = game("a", 0), later = game("b", 0, "2026-11-16T08:00:00.000Z");
  const finished = { ...first, status: "FINISHED" as const, version: 4 };
  expect(mergeGameHistory([finished], [first, later])).toEqual([later, finished]);
});
