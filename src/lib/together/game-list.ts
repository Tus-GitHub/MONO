import type { GameDTO } from "./types";

export const RECENT_GAME_WINDOW_MS = 60 * 60 * 1000;

export function recentGames(games: GameDTO[], observedAt: string) {
  const cutoff = Date.parse(observedAt) - RECENT_GAME_WINDOW_MS;
  return games.filter((game) => Date.parse(game.updatedAt) >= cutoff)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id));
}

/** History pagination and live snapshots can overlap; never replace a newer board. */
export function mergeGameHistory(older: GameDTO[], newer: GameDTO[]) {
  const rows = new Map(older.map((game) => [game.id, game]));
  for (const game of newer) if (!rows.has(game.id) || game.version >= rows.get(game.id)!.version) rows.set(game.id, game);
  return [...rows.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}
