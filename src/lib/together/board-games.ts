import { Chess, type Square } from "chess.js";
import { cloned, linePlayers, numberData, opponent, scoreOutcome, type ArcadeMove, type ArcadeState, type ArcadeTurn, type Side } from "./arcade-state";

export function reversiFlips(board: number[], cell: number, side: Side): number[] {
  if (cell < 0 || cell >= 16 || board[cell]) return [];
  const flips: number[] = [];
  for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const path: number[] = []; let y = Math.floor(cell / 4) + dy, x = cell % 4 + dx;
    while (y >= 0 && y < 4 && x >= 0 && x < 4 && board[y * 4 + x] === opponent(side) + 1) { path.push(y * 4 + x); y += dy; x += dx; }
    if (path.length && y >= 0 && y < 4 && x >= 0 && x < 4 && board[y * 4 + x] === side + 1) flips.push(...path);
  }
  return flips;
}
export interface PieceMove { from: number; to: number; jumped?: number }
const pieceSide = (piece: number): Side | null => piece === 1 || piece === 3 ? 0 : piece === 2 || piece === 4 ? 1 : null;
export function checkersMoves(state: ArcadeState, side: Side): PieceMove[] {
  const moves: PieceMove[] = [], jumps: PieceMove[] = [], forced = numberData(state, "forced");
  for (let from = 0; from < 64; from++) {
    const piece = state.board[from];
    if (pieceSide(piece) !== side || (forced >= 0 && forced !== from)) continue;
    const directions = piece > 2 ? [-1, 1] : [side === 0 ? 1 : -1];
    for (const dy of directions) for (const dx of [-1, 1]) {
      const y = Math.floor(from / 8), x = from % 8, y1 = y + dy, x1 = x + dx, y2 = y + 2 * dy, x2 = x + 2 * dx;
      if (y1 < 0 || y1 > 7 || x1 < 0 || x1 > 7) continue;
      const mid = y1 * 8 + x1;
      if (!state.board[mid] && forced < 0) moves.push({ from, to: mid });
      else if (pieceSide(state.board[mid]) === opponent(side) && y2 >= 0 && y2 < 8 && x2 >= 0 && x2 < 8 && !state.board[y2 * 8 + x2]) jumps.push({ from, to: y2 * 8 + x2, jumped: mid });
    }
  }
  return jumps.length ? jumps : forced >= 0 ? [] : moves;
}
export function breakthroughMoves(state: ArcadeState, side: Side): PieceMove[] {
  const moves: PieceMove[] = [], dy = side === 0 ? 1 : -1;
  for (let from = 0; from < 36; from++) if (state.board[from] === side + 1) {
    const y = Math.floor(from / 6) + dy, x = from % 6;
    if (y < 0 || y > 5) continue;
    for (const dx of [-1, 0, 1]) {
      const col = x + dx, to = y * 6 + col;
      if (col >= 0 && col < 6 && state.board[to] !== side + 1 && (dx !== 0 || state.board[to] === 0)) moves.push({ from, to });
    }
  }
  return moves;
}
export const chessSquare = (cell: number): Square => `${"abcdefgh"[cell % 8]}${8 - Math.floor(cell / 8)}` as Square;
export const chessCell = (square: string) => (8 - Number(square[1])) * 8 + "abcdefgh".indexOf(square[0]);
export function chessBoard(chess: Chess): number[] {
  return chess.board().flat().map((piece) => piece ? "pnbrqk".indexOf(piece.type) + 1 + (piece.color === "b" ? 6 : 0) : 0);
}
export function chessMoves(state: ArcadeState): PieceMove[] {
  return new Chess(String(state.data.fen)).moves({ verbose: true }).map((move) => ({ from: chessCell(move.from), to: chessCell(move.to) }));
}
export function hexConnected(board: number[], side: Side): boolean {
  const queue = Array.from({ length: 5 }, (_, n) => side === 0 ? n : n * 5).filter((cell) => board[cell] === side + 1);
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i], row = Math.floor(cell / 5), col = cell % 5;
    if (side === 0 ? row === 4 : col === 4) return true;
    for (const [dy, dx] of [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]]) {
      const y = row + dy, x = col + dx, next = y * 5 + x;
      if (y >= 0 && y < 5 && x >= 0 && x < 5 && board[next] === side + 1 && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return false;
}
export function dominoMoves(state: ArcadeState, side: Side) {
  return state.board.flatMap((value, cell) => !value && (side === 0 ? cell < 30 && !state.board[cell + 6] : cell % 6 < 5 && !state.board[cell + 1]) ? [cell] : []);
}

export function moveBoard(current: ArcadeState, side: Side, move: ArcadeMove): ArcadeTurn {
  const state = cloned(current), next = opponent(side), piece = side + 1;
  const finish = (outcome?: ArcadeTurn["outcome"]): ArcadeTurn => ({ state, outcome });
  if (state.kind === "CHESS") {
    if (move.type !== "move") throw new Error("Select a piece and a destination.");
    const chess = new Chess(String(state.data.fen));
    if (chess.isGameOver()) throw new Error("This round is finished.");
    try { chess.move({ from: chessSquare(move.from), to: chessSquare(move.to), promotion: move.promotion ?? "q" }); }
    catch { throw new Error("Choose a legal chess move."); }
    state.data.fen = chess.fen(); state.board = chessBoard(chess); state.turn = next;
    const position = chess.fen().split(" ").slice(0, 4).join(" ");
    const history = [...(Array.isArray(state.data.history) ? state.data.history as string[] : []), position].slice(-100);
    state.data.history = history;
    return finish(chess.isCheckmate() ? side : chess.isDraw() || history.filter((item) => item === position).length >= 3 ? "draw" : undefined);
  }
  if (state.kind === "CHECKERS" || state.kind === "BREAKTHROUGH") {
    if (move.type !== "move") throw new Error("Select a piece and a destination.");
    const legal = (state.kind === "CHECKERS" ? checkersMoves(state, side) : breakthroughMoves(state, side)).find((item) => item.from === move.from && item.to === move.to);
    if (!legal) throw new Error("Choose a legal move. Captures are compulsory in checkers.");
    state.board[move.to] = state.board[move.from]; state.board[move.from] = 0;
    if (state.kind === "BREAKTHROUGH") {
      state.turn = next;
      return finish(Math.floor(move.to / 6) === (side === 0 ? 5 : 0) || !breakthroughMoves(state, next).length ? side : undefined);
    }
    if (legal.jumped != null) state.board[legal.jumped] = 0;
    const crown = state.board[move.to] < 3 && Math.floor(move.to / 8) === (side === 0 ? 7 : 0);
    if (crown) state.board[move.to] += 2;
    state.data.forced = legal.jumped != null && !crown ? move.to : -1;
    if (numberData(state, "forced") >= 0 && checkersMoves(state, side).length) return finish();
    state.data.forced = -1; state.turn = next;
    state.data.quiet = legal.jumped != null || crown ? 0 : numberData(state, "quiet") + 1;
    const position = `${state.board.join(",")}:${state.turn}`;
    const history = [...(Array.isArray(state.data.history) ? state.data.history as string[] : []), position].slice(-100);
    state.data.history = history;
    return finish(!checkersMoves(state, next).length ? side : numberData(state, "quiet") >= 80 || history.filter((item) => item === position).length >= 3 ? "draw" : undefined);
  }
  if (state.kind === "PENTAGO" && state.phase === "rotate") {
    if (move.type !== "rotate") throw new Error("Rotate a quadrant to finish your turn.");
    const row = Math.floor(move.quadrant / 2) * 3, col = move.quadrant % 2 * 3, old = [...state.board];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const yy = move.direction === 1 ? x : 2 - x, xx = move.direction === 1 ? 2 - y : y;
      state.board[(row + yy) * 6 + col + xx] = old[(row + y) * 6 + col + x];
    }
    state.phase = "move"; state.turn = next;
    const won = linePlayers(state.board, 6, 6, 5);
    return finish(won.size > 1 ? "draw" : won.size ? ([...won][0] - 1) as Side : state.board.every(Boolean) ? "draw" : undefined);
  }
  if (move.type !== "place" || !Number.isInteger(move.cell) || move.cell < 0 || move.cell >= state.board.length || state.board[move.cell]) throw new Error("Choose an empty square.");
  const cell = move.cell;
  if (state.kind === "REVERSI") {
    const flips = reversiFlips(state.board, cell, side);
    if (!flips.length) throw new Error("Choose a square that flips your partner's discs.");
    for (const target of [cell, ...flips]) state.board[target] = piece;
    state.scores = [state.board.filter((p) => p === 1).length, state.board.filter((p) => p === 2).length];
    const can = (who: Side) => state.board.some((_, index) => reversiFlips(state.board, index, who).length);
    state.turn = can(next) ? next : side;
    return finish(!can(next) && !can(side) ? scoreOutcome(state.scores) : undefined);
  }
  if (state.kind === "DOMINEERING") {
    if (!dominoMoves(state, side).includes(cell)) throw new Error("Your domino needs two empty spaces.");
    state.board[cell] = state.board[cell + (side === 0 ? 6 : 1)] = piece; state.turn = next;
    return finish(dominoMoves(state, next).length ? undefined : side);
  }
  if (state.kind === "CHOMP") {
    const row = Math.floor(cell / 7), col = cell % 7;
    for (let y = row; y < 5; y++) for (let x = col; x < 7; x++) state.board[y * 7 + x] = piece;
    state.turn = next; return finish(cell === 0 ? next : undefined);
  }
  if (state.kind === "SOS") {
    if (move.mark !== "S" && move.mark !== "O") throw new Error("Choose S or O.");
    state.board[cell] = move.mark === "S" ? 1 : 2;
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const made = lines.filter((line) => line.includes(cell) && line.map((n) => state.board[n]).join("") === "121").length;
    state.scores[side] += made; if (!made) state.turn = next;
    return finish(state.board.every(Boolean) ? scoreOutcome(state.scores) : undefined);
  }
  if (state.kind === "ORDER_CHAOS") {
    if (move.mark !== "X" && move.mark !== "O") throw new Error("Choose X or O.");
    state.board[cell] = move.mark === "X" ? 1 : 2; state.turn = next;
    return finish(linePlayers(state.board, 6, 6, 5).size ? 0 : state.board.every(Boolean) ? 1 : undefined);
  }
  state.board[cell] = piece;
  if (state.kind === "HEX") { state.turn = next; return finish(hexConnected(state.board, side) ? side : undefined); }
  if (state.kind === "PENTAGO") {
    if (linePlayers(state.board, 6, 6, 5).size) return finish(side);
    state.phase = "rotate"; return finish();
  }
  state.turn = next;
  return finish(linePlayers(state.board, 9, 9, 5).size ? side : state.board.every(Boolean) ? "draw" : undefined);
}
