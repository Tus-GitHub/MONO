import { z } from "zod";
export const arcadeKind = z.enum(["GOMOKU", "REVERSI", "DOTS_BOXES", "NIM", "TAKE_21", "PIG", "ROCK_PAPER_SCISSORS", "MEMORY", "BATTLESHIP", "CHESS", "CHECKERS", "SNAKES_LADDERS", "MANCALA", "SOS", "ORDER_CHAOS", "HEX", "DOMINEERING", "CHOMP", "BREAKTHROUGH", "PENTAGO", "HIGHER_LOWER"]);
export const arcadeSchema = z.object({
  type: z.literal("ARCADE"), kind: arcadeKind, turn: z.union([z.literal(0), z.literal(1)]),
  board: z.array(z.number().int()).max(100), scores: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  phase: z.enum(["move", "rotate", "reveal", "choose"]),
  data: z.record(z.union([z.number().finite(), z.string().max(1000), z.array(z.number()).max(100), z.array(z.string()).max(100)])),
});
export type ArcadeKind = z.infer<typeof arcadeKind>;
export type ArcadeState = z.infer<typeof arcadeSchema>;
export const arcadeMove = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), cell: z.number().int().min(0).max(99), mark: z.enum(["S", "O", "X"]).optional() }),
  z.object({ type: z.literal("roll") }), z.object({ type: z.literal("hold") }), z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("choose"), value: z.string().min(1).max(20) }),
  z.object({ type: z.literal("take"), pile: z.number().int().min(0).max(2), count: z.number().int().min(1).max(20) }),
  z.object({ type: z.literal("move"), from: z.number().int().min(0).max(63), to: z.number().int().min(0).max(63), promotion: z.enum(["q", "r", "b", "n"]).optional() }),
  z.object({ type: z.literal("rotate"), quadrant: z.number().int().min(0).max(3), direction: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ type: z.literal("guess"), value: z.number().int().min(1).max(100) }),
]);
export type ArcadeMove = z.infer<typeof arcadeMove>;
export type Side = 0 | 1;
export type Outcome = Side | "draw";
export interface ArcadeTurn { state: ArcadeState; outcome?: Outcome }
export const opponent = (side: Side): Side => side === 0 ? 1 : 0;
export const numberData = (state: ArcadeState, key: string) => Number(state.data[key] ?? 0);
export const arrayData = (state: ArcadeState, key: string): number[] => Array.isArray(state.data[key]) ? state.data[key] as number[] : [];
export const scoreOutcome = (scores: [number, number]): Outcome => scores[0] === scores[1] ? "draw" : scores[0] > scores[1] ? 0 : 1;
export const cloned = (state: ArcadeState): ArcadeState => JSON.parse(JSON.stringify(state));
export function linePlayers(board: number[], rows: number, cols: number, length: number): Set<number> {
  const winners = new Set<number>();
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const value = board[row * cols + col]; if (!value) continue;
    for (const [dy, dx] of [[1, 0], [0, 1], [1, 1], [1, -1]]) if (Array.from({ length }, (_, n) => [row + n * dy, col + n * dx])
      .every(([y, x]) => y >= 0 && y < rows && x >= 0 && x < cols && board[y * cols + x] === value)) winners.add(value);
  }
  return winners;
}
