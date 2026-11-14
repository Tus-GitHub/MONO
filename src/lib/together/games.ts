import { z } from "zod";
import { arcadeSchema, createArcade, moveArcade, type ArcadeState, type ArcadeMove } from "./arcade";

export const GAME_LABEL = {
  TIC_TAC_TOE: "Tic-tac-toe", CONNECT_FOUR: "Connect Four", LUDO: "Ludo", GOMOKU: "Gomoku",
  REVERSI: "Reversi", DOTS_BOXES: "Dots & Boxes", NIM: "Nim", TAKE_21: "Race to 21", PIG: "Pig Dice",
  ROCK_PAPER_SCISSORS: "Rock Paper Scissors", MEMORY: "Memory Match", BATTLESHIP: "Mini Battleship",
  CHESS: "Chess", CHECKERS: "Checkers", SNAKES_LADDERS: "Snakes & Ladders", MANCALA: "Mancala",
  SOS: "SOS", ORDER_CHAOS: "Order & Chaos", HEX: "Hex", DOMINEERING: "Domineering", CHOMP: "Chomp",
  BREAKTHROUGH: "Breakthrough", PENTAGO: "Pentago", HIGHER_LOWER: "Higher or Lower",
} as const;
export type GameKind = keyof typeof GAME_LABEL;
export type Player = 0 | 1;
const player = z.union([z.literal(0), z.literal(1)]);
const cell = z.union([z.literal(0), z.literal(1), z.null()]);
export const boardSchema = z.object({ type: z.enum(["TIC_TAC_TOE", "CONNECT_FOUR"]), board: z.array(cell), turn: player });
export const ludoSchema = z.object({ type: z.literal("LUDO"), tokens: z.tuple([z.array(z.number().int().min(-1).max(57)).length(4), z.array(z.number().int().min(-1).max(57)).length(4)]), turn: player, die: z.number().int().min(1).max(6).nullable(), lastRoll: z.number().int().min(1).max(6).optional() });
export type BoardState = z.infer<typeof boardSchema>;
export type LudoState = z.infer<typeof ludoSchema>;
export type GameState = BoardState | LudoState | ArcadeState;
export type GameMove = ArcadeMove | { type: "token"; token: number };
export interface GameTurn { state: GameState; outcome?: Player | "draw" }
export const other = (who: Player): Player => who === 0 ? 1 : 0;
export const LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const ludoSquare = (who: Player, progress: number) => (progress + who * 26) % 52;

export function newGame(kind: GameKind, random: (max: number) => number): GameState {
  if (!["TIC_TAC_TOE", "CONNECT_FOUR", "LUDO"].includes(kind)) return createArcade(kind, random);
  return kind === "LUDO" ? { type: "LUDO", tokens: [Array(4).fill(-1), Array(4).fill(-1)], turn: 0, die: null }
    : { type: kind as BoardState["type"], board: Array(kind === "TIC_TAC_TOE" ? 9 : 42).fill(null), turn: 0 };
}
export function parseGame(kind: GameKind, value: unknown): GameState {
  if (kind === "LUDO") return ludoSchema.parse(value);
  if (kind !== "TIC_TAC_TOE" && kind !== "CONNECT_FOUR") {
    const state = arcadeSchema.parse(value);
    if (state.kind !== kind) throw new Error("Invalid game.");
    return state;
  }
  const state = boardSchema.parse(value);
  if (state.type !== kind || state.board.length !== (kind === "TIC_TAC_TOE" ? 9 : 42)) throw new Error("Invalid game board.");
  return state;
}
export function movableTokens(state: LudoState): number[] {
  if (!state.die) return [];
  return state.tokens[state.turn].flatMap((position, index) => position < 0 ? state.die === 6 ? [index] : []
    : position < 57 && position + state.die! <= 57 ? [index] : []);
}
function winner(board: (Player | null)[], rows: number, cols: number, length: number): Player | "draw" | undefined {
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const value = board[row * cols + col];
    if (value == null) continue;
    for (const [dy, dx] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      if (Array.from({ length }, (_, n) => [row + n * dy, col + n * dx]).every(([y, x]) => y >= 0 && y < rows && x >= 0 && x < cols && board[y * cols + x] === value)) return value;
    }
  }
  return board.every((value) => value != null) ? "draw" : undefined;
}

/** Pure rules; the service supplies the authenticated player and a cryptographic server die. */
export function playGame(current: GameState, who: Player, move: GameMove, serverDie?: number): GameTurn {
  if (current.type === "ARCADE") {
    if (move.type === "token") throw new Error("Choose a valid move.");
    return moveArcade(current, who, move, serverDie);
  }
  if (current.turn !== who) throw new Error("It's your partner's turn.");
  if (current.type !== "LUDO") {
    if (winner(current.board, current.type === "TIC_TAC_TOE" ? 3 : 6, current.type === "TIC_TAC_TOE" ? 3 : 7, current.type === "TIC_TAC_TOE" ? 3 : 4) !== undefined) throw new Error("This round is already finished.");
    if (move.type !== "place" || !Number.isInteger(move.cell)) throw new Error("Choose a valid square.");
    const board = [...current.board];
    let index = move.cell;
    if (current.type === "CONNECT_FOUR") {
      if (index < 0 || index > 6) throw new Error("Choose a valid column.");
      index = Array.from({ length: 6 }, (_, row) => (5 - row) * 7 + move.cell).find((slot) => board[slot] === null) ?? -1;
    }
    if (index < 0 || index >= board.length || board[index] !== null) throw new Error("That space is already taken.");
    board[index] = who;
    return { state: { ...current, board, turn: other(who) }, outcome: winner(board, current.type === "TIC_TAC_TOE" ? 3 : 6, current.type === "TIC_TAC_TOE" ? 3 : 7, current.type === "TIC_TAC_TOE" ? 3 : 4) };
  }
  const state: LudoState = { ...current, tokens: [[...current.tokens[0]], [...current.tokens[1]]] };
  if (state.tokens.some((tokens) => tokens.every((position) => position === 57))) throw new Error("This round is already finished.");
  if (move.type === "roll") {
    if (state.die) throw new Error("Move a token before rolling again.");
    if (!Number.isInteger(serverDie) || serverDie! < 1 || serverDie! > 6) throw new Error("Invalid die.");
    state.die = serverDie!;
    state.lastRoll = serverDie!;
    if (!movableTokens(state).length) { state.turn = other(who); state.die = null; }
    return { state };
  }
  if (move.type !== "token" || !movableTokens(state).includes(move.token)) throw new Error("Choose a highlighted token.");
  const die = state.die!;
  const before = state.tokens[who][move.token];
  const position = before < 0 ? 0 : before + die;
  state.tokens[who][move.token] = position;
  let captured = false;
  const square = ludoSquare(who, position);
  if (position < 52 && !LUDO_SAFE.has(square)) state.tokens[other(who)] = state.tokens[other(who)].map((opponent) => {
    if (opponent >= 0 && opponent < 52 && ludoSquare(other(who), opponent) === square) { captured = true; return -1; }
    return opponent;
  });
  state.die = null;
  if (die !== 6 && !captured && position !== 57) state.turn = other(who);
  return { state, outcome: state.tokens[who].every((token) => token === 57) ? who : undefined };
}
