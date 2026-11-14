import { Chess } from "chess.js";
import { arcadeKind, arrayData, cloned, numberData, opponent, scoreOutcome, type ArcadeMove, type ArcadeState, type ArcadeTurn, type Side } from "./arcade-state";
import { chessBoard, moveBoard } from "./board-games";
export { arcadeSchema, arcadeMove } from "./arcade-state";
export type { ArcadeState, ArcadeMove } from "./arcade-state";

const boardSize: Record<string, number> = { GOMOKU: 81, REVERSI: 16, DOTS_BOXES: 24, MEMORY: 16, BATTLESHIP: 50,
  CHESS: 64, CHECKERS: 64, MANCALA: 14, SOS: 9, ORDER_CHAOS: 36, HEX: 25, DOMINEERING: 36, CHOMP: 35, BREAKTHROUGH: 36, PENTAGO: 36 };
export const SNAKES: Record<number, number> = { 4:14, 9:31, 20:38, 28:84, 40:59, 63:81, 71:91, 17:7, 54:34, 62:19, 64:60, 87:24, 93:73, 95:75, 99:78 };

function fleet(random: (max: number) => number): number[] {
  const taken = new Set<number>();
  for (const length of [3, 2]) {
    const possibilities: number[][] = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) for (const horizontal of [true, false]) {
      if (horizontal ? col + length > 5 : row + length > 5) continue;
      const cells = Array.from({ length }, (_, n) => (row + (horizontal ? 0 : n)) * 5 + col + (horizontal ? n : 0));
      if (cells.every((cell) => !taken.has(cell))) possibilities.push(cells);
    }
    for (const cell of possibilities[random(possibilities.length)]) taken.add(cell);
  }
  return [...taken];
}
export function createArcade(kindValue: string, random: (max: number) => number): ArcadeState {
  const kind = arcadeKind.parse(kindValue);
  const state: ArcadeState = { type: "ARCADE", kind, turn: 0, board: Array(boardSize[kind] ?? 0).fill(0), scores: [0, 0], phase: "move", data: {} };
  if (kind === "REVERSI") { for (const i of [5, 10]) state.board[i] = 1; for (const i of [6, 9]) state.board[i] = 2; state.scores = [2, 2]; }
  if (kind === "NIM") state.data.piles = [3, 4, 5];
  if (kind === "TAKE_21") state.data.total = 0;
  if (kind === "DOTS_BOXES") state.data.boxes = Array(9).fill(0);
  if (kind === "PIG") state.data.running = 0;
  if (kind === "ROCK_PAPER_SCISSORS") { state.phase = "choose"; state.data.pick0 = ""; state.data.pick1 = ""; }
  if (kind === "HIGHER_LOWER") { state.data.secret = random(100) + 1; state.data.low = 1; state.data.high = 100; }
  if (kind === "MEMORY") {
    const deck = Array.from({ length: 16 }, (_, n) => n % 8);
    for (let i = deck.length - 1; i > 0; i--) { const j = random(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    state.data.deck = deck; state.data.first = -1; state.data.second = -1;
  }
  if (kind === "BATTLESHIP") { state.data.fleet0 = fleet(random); state.data.fleet1 = fleet(random); }
  if (kind === "CHESS") { const chess = new Chess(); state.data.fen = chess.fen(); state.data.history = [chess.fen().split(" ").slice(0, 4).join(" ")]; state.board = chessBoard(chess); }
  if (kind === "CHECKERS") {
    state.data.forced = -1;
    for (let i = 0; i < 64; i++) if ((Math.floor(i / 8) + i % 8) % 2) state.board[i] = i < 24 ? 1 : i >= 40 ? 2 : 0;
  }
  if (kind === "BREAKTHROUGH") for (let i = 0; i < 36; i++) state.board[i] = i < 12 ? 1 : i >= 24 ? 2 : 0;
  if (kind === "MANCALA") state.board = Array.from({ length: 14 }, (_, n) => n === 6 || n === 13 ? 0 : 4);
  return state;
}

/** Hide opponent choices, secret numbers, cards and ships before serializing to either browser. */
export function publicArcade(current: ArcadeState, side: Side): ArcadeState {
  const state = cloned(current);
  if (state.kind === "HIGHER_LOWER") delete state.data.secret;
  if (state.kind === "BATTLESHIP") delete state.data[`fleet${opponent(side)}`];
  if (state.kind === "ROCK_PAPER_SCISSORS" && state.phase !== "reveal") state.data[`pick${opponent(side)}`] = state.data[`pick${opponent(side)}`] ? "hidden" : "";
  if (state.kind === "MEMORY") state.data.deck = arrayData(state, "deck").map((value, cell) => state.board[cell] || cell === numberData(state, "first") || cell === numberData(state, "second") ? value : -1);
  return state;
}

export function moveArcade(current: ArcadeState, side: Side, input: ArcadeMove, serverDie?: number): ArcadeTurn {
  if (current.kind !== "ROCK_PAPER_SCISSORS" && current.turn !== side) throw new Error("It's your partner's turn.");
  const state = cloned(current), next = opponent(side), move = input;
  const done = (outcome?: ArcadeTurn["outcome"]): ArcadeTurn => ({ state, outcome });
  const die = () => { if (!Number.isInteger(serverDie) || serverDie! < 1 || serverDie! > 6) throw new Error("Invalid die."); return serverDie!; };
  if (state.kind === "NIM") {
    const piles = [...arrayData(state, "piles")];
    if (move.type !== "take" || !Number.isInteger(move.count) || move.count < 1 || move.pile < 0 || move.pile > 2 || move.count > piles[move.pile]) throw new Error("Choose tokens from one pile.");
    piles[move.pile] -= move.count; state.data.piles = piles; state.turn = next;
    return done(piles.every((n) => n === 0) ? side : undefined);
  }
  if (state.kind === "TAKE_21") {
    if (move.type !== "choose" || !["1", "2", "3"].includes(move.value) || numberData(state, "total") + Number(move.value) > 21) throw new Error("Add 1, 2 or 3 without going over 21.");
    state.data.total = numberData(state, "total") + Number(move.value); state.turn = next;
    return done(state.data.total === 21 ? side : undefined);
  }
  if (state.kind === "PIG") {
    if (move.type === "roll") {
      state.data.lastDie = die();
      if (state.data.lastDie === 1) { state.data.running = 0; state.turn = next; }
      else state.data.running = numberData(state, "running") + Number(state.data.lastDie);
    } else if (move.type === "hold" && numberData(state, "running") > 0) {
      state.scores[side] += numberData(state, "running"); state.data.running = 0; state.turn = next;
    } else throw new Error("Roll, or hold your unbanked points.");
    return done(state.scores[side] >= 50 ? side : undefined);
  }
  if (state.kind === "SNAKES_LADDERS") {
    if (move.type !== "roll") throw new Error("Roll the die.");
    const rolled = die(); state.data.lastDie = rolled;
    const target = state.scores[side] + rolled;
    if (target <= 100) state.scores[side] = SNAKES[target] ?? target;
    state.turn = next; return done(state.scores[side] === 100 ? side : undefined);
  }
  if (state.kind === "HIGHER_LOWER") {
    if (move.type !== "guess" || !Number.isInteger(move.value) || move.value < numberData(state, "low") || move.value > numberData(state, "high")) throw new Error("Guess a number in the remaining range.");
    const secret = numberData(state, "secret"); state.data.lastGuess = move.value; state.turn = next;
    if (move.value === secret) return done(side);
    if (move.value < secret) state.data.low = move.value + 1; else state.data.high = move.value - 1;
    return done();
  }
  if (state.kind === "ROCK_PAPER_SCISSORS") {
    if (state.phase === "reveal") {
      if (move.type !== "continue") throw new Error("Start the next round.");
      state.data.pick0 = ""; state.data.pick1 = ""; state.phase = "choose"; return done();
    }
    if (move.type !== "choose" || !["rock", "paper", "scissors"].includes(move.value) || state.data[`pick${side}`]) throw new Error("Choose once, then wait for your partner.");
    state.data[`pick${side}`] = move.value;
    const a = String(state.data.pick0), b = String(state.data.pick1);
    if (a && b) {
      state.phase = "reveal";
      if (a !== b) { const winner: Side = (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper") ? 0 : 1; state.scores[winner]++; }
    }
    return done(state.scores[0] >= 3 ? 0 : state.scores[1] >= 3 ? 1 : undefined);
  }
  if (state.kind === "MEMORY") {
    if (state.phase === "reveal") {
      if (move.type !== "continue") throw new Error("Turn the cards back over first.");
      state.phase = "move"; state.data.first = -1; state.data.second = -1; state.turn = next; return done();
    }
    const first = numberData(state, "first");
    if (move.type !== "place" || move.cell < 0 || move.cell >= 16 || state.board[move.cell] || move.cell === first) throw new Error("Choose a face-down card.");
    if (first < 0) { state.data.first = move.cell; return done(); }
    state.data.second = move.cell;
    const deck = arrayData(state, "deck");
    if (deck[first] === deck[move.cell]) {
      state.board[first] = state.board[move.cell] = side + 1; state.scores[side]++;
      state.data.first = -1; state.data.second = -1;
    } else state.phase = "reveal";
    return done(state.board.every(Boolean) ? scoreOutcome(state.scores) : undefined);
  }
  if (state.kind === "BATTLESHIP") {
    if (move.type !== "place" || move.cell < 0 || move.cell >= 25 || state.board[side * 25 + move.cell]) throw new Error("Choose a square you haven't fired at.");
    const hit = arrayData(state, `fleet${next}`).includes(move.cell);
    state.board[side * 25 + move.cell] = hit ? 2 : 1;
    if (hit) state.scores[side]++;
    state.turn = next; return done(state.scores[side] === 5 ? side : undefined);
  }
  if (state.kind === "DOTS_BOXES") {
    if (move.type !== "place" || move.cell < 0 || move.cell >= 24 || state.board[move.cell]) throw new Error("Choose an unused edge.");
    state.board[move.cell] = side + 1;
    const boxes = [...arrayData(state, "boxes")]; let gained = 0;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const edges = [row * 3 + col, (row + 1) * 3 + col, 12 + row * 4 + col, 12 + row * 4 + col + 1], index = row * 3 + col;
      if (!boxes[index] && edges.every((edge) => state.board[edge])) { boxes[index] = side + 1; gained++; }
    }
    state.data.boxes = boxes; state.scores[side] += gained; if (!gained) state.turn = next;
    return done(boxes.every(Boolean) ? scoreOutcome(state.scores) : undefined);
  }
  if (state.kind === "MANCALA") {
    if (move.type !== "place" || !Number.isInteger(move.cell) || !(side === 0 ? move.cell >= 0 && move.cell < 6 : move.cell >= 7 && move.cell < 13) || !state.board[move.cell]) throw new Error("Choose a non-empty pit on your side.");
    const store = side === 0 ? 6 : 13, skip = side === 0 ? 13 : 6;
    let stones = state.board[move.cell], index = move.cell; state.board[index] = 0;
    while (stones) { index = (index + 1) % 14; if (index !== skip) { state.board[index]++; stones--; } }
    if ((side === 0 ? index < 6 : index > 6 && index < 13) && state.board[index] === 1 && state.board[12 - index]) {
      state.board[store] += state.board[12 - index] + 1; state.board[index] = 0; state.board[12 - index] = 0;
    }
    const ended = state.board.slice(0, 6).every((n) => !n) || state.board.slice(7, 13).every((n) => !n);
    if (ended) for (let i = 0; i < 14; i++) if (i !== 6 && i !== 13) { state.board[i < 6 ? 6 : 13] += state.board[i]; state.board[i] = 0; }
    state.scores = [state.board[6], state.board[13]]; if (index !== store) state.turn = next;
    return done(ended ? scoreOutcome(state.scores) : undefined);
  }
  return moveBoard(state, side, move);
}
