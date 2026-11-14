import { Chess } from "chess.js";
import { arrayData, numberData, type ArcadeMove, type ArcadeState, type Side } from "./arcade-state";
import { breakthroughMoves, checkersMoves, chessCell, dominoMoves, reversiFlips } from "./board-games";
import { SNAKES } from "./arcade";

export const GAME_RULES: Record<string, string> = {
  TIC_TAC_TOE: "Take turns placing X and O. Make a line of three to win.",
  CONNECT_FOUR: "Drop a disc into a column. Connect four horizontally, vertically or diagonally.",
  LUDO: "Four tokens each. Roll a six to leave home. A six, capture or finish gives another turn. Star squares are safe; landing elsewhere captures opposing tokens. Reach the goal with an exact roll. First to finish all four wins. No blockades or three-sixes penalty.",
  GOMOKU: "Take turns placing stones. First to connect five in any straight line wins.",
  REVERSI: "Place a disc to trap a straight line of opposing discs between yours. Those discs flip. If one player cannot move, their turn passes automatically. Most discs at the end wins.",
  DOTS_BOXES: "Choose an edge between dots. Complete a box to score a point and play again. Most of the nine boxes wins.",
  NIM: "Remove any number of tokens from exactly one pile. Taking the last token wins.",
  TAKE_21: "Start at zero. Add one, two or three on your turn. Whoever reaches exactly 21 wins.",
  PIG: "Roll to build unbanked points; roll a one and lose this turn's points. Hold to bank them. First to bank 50 wins.",
  ROCK_PAPER_SCISSORS: "Choose privately. Both choices reveal together. Rock beats scissors, scissors beats paper, paper beats rock. First to three round wins wins the match.",
  MEMORY: "Turn over two cards. A pair earns a point and another turn. Otherwise turn them back over and pass. Most pairs wins.",
  BATTLESHIP: "Two ships of length three and two are placed for each of you automatically. Take turns firing at the 5×5 enemy grid. Hit all five ship squares to win. Your own fleet is shown below.",
  CHESS: "Standard chess. Select a piece, then a legal highlighted square. Castling, en passant, promotion, checkmate and draws are enforced. Choose a promotion piece before moving a pawn to its final rank.",
  CHECKERS: "Move diagonally on dark squares. Captures are compulsory; continue a capture chain with the same piece. Reach the far rank to become a king. Crowning ends that turn. No remaining legal move loses. Three repeated positions or 80 turns without capture/crowning draw.",
  SNAKES_LADDERS: "Take turns rolling. Climb ladders and slide down snakes. You need an exact roll to reach 100; an overshoot stays put.",
  MANCALA: "Choose a pit on your side. Sow counter-clockwise, skipping the other store. Ending in your store gives another turn. Ending in your empty pit captures opposite stones. When one side empties, the remaining stones are banked. Most stones wins.",
  SOS: "Either player may place S or O. Each new straight SOS scores a point and gives another turn. Most points when the board fills wins.",
  ORDER_CHAOS: "Player one is Order; player two is Chaos. Both may place X or O. Order wins if either symbol makes five in a row. Chaos wins if the board fills without a five.",
  HEX: "Player one connects top to bottom. Player two connects left to right. Your stones connect through the six adjacent hexagons. The first connected path wins.",
  DOMINEERING: "Player one places vertical dominoes; player two places horizontal dominoes. Each uses two empty squares. If your opponent has no legal placement, you win.",
  CHOMP: "Choose a cookie to eat it and every cookie below and to its right. The top-left cookie is poisoned: taking it loses.",
  BREAKTHROUGH: "Move a pawn one square forward, straight into empty space or diagonally into empty/enemy space. Reach the far edge or leave your opponent without a move to win.",
  PENTAGO: "Place a marble, then rotate any 3×3 quadrant a quarter turn. Five in a row wins. A five made immediately by placement wins before rotation. Simultaneous winning lines after rotation draw.",
  HIGHER_LOWER: "A secret number between 1 and 100 is chosen by the server. Take turns guessing. Each miss narrows the shared range. Guess it exactly to win.",
};

export function legalArcadeMoves(state: ArcadeState, side: Side): ArcadeMove[] {
  if (state.kind !== "ROCK_PAPER_SCISSORS" && state.turn !== side) return [];
  const cells = () => state.board.flatMap((value, cell) => !value ? [{ type: "place" as const, cell }] : []);
  switch (state.kind) {
    case "CHESS": return new Chess(String(state.data.fen)).moves({ verbose: true }).map((move) => ({ type: "move", from: chessCell(move.from), to: chessCell(move.to), ...(move.promotion ? { promotion: move.promotion as "q" | "r" | "b" | "n" } : {}) }));
    case "CHECKERS": return checkersMoves(state, side).map(({ from, to }) => ({ type: "move", from, to }));
    case "BREAKTHROUGH": return breakthroughMoves(state, side).map(({ from, to }) => ({ type: "move", from, to }));
    case "REVERSI": return cells().filter((move) => reversiFlips(state.board, move.cell, side).length);
    case "DOMINEERING": return dominoMoves(state, side).map((cell) => ({ type: "place", cell }));
    case "NIM": return arrayData(state, "piles").flatMap((count, pile) => Array.from({ length: count }, (_, n) => ({ type: "take" as const, pile, count: n + 1 })));
    case "TAKE_21": return [1, 2, 3].filter((n) => numberData(state, "total") + n <= 21).map((n) => ({ type: "choose", value: String(n) }));
    case "PIG": return numberData(state, "running") ? [{ type: "roll" }, { type: "hold" }] : [{ type: "roll" }];
    case "SNAKES_LADDERS": return [{ type: "roll" }];
    case "HIGHER_LOWER": return Array.from({ length: Math.max(0, numberData(state, "high") - numberData(state, "low") + 1) }, (_, n) => ({ type: "guess", value: n + numberData(state, "low") }));
    case "ROCK_PAPER_SCISSORS": return state.phase === "reveal" ? [{ type: "continue" }] : state.data[`pick${side}`] ? [] : ["rock", "paper", "scissors"].map((value) => ({ type: "choose", value }));
    case "MEMORY": return state.phase === "reveal" ? [{ type: "continue" }] : cells().filter((move) => move.cell !== numberData(state, "first"));
    case "BATTLESHIP": return Array.from({ length: 25 }, (_, cell) => ({ type: "place" as const, cell })).filter((move) => !state.board[side * 25 + move.cell]);
    case "MANCALA": return Array.from({ length: 6 }, (_, n) => n + (side === 0 ? 0 : 7)).filter((cell) => state.board[cell] > 0).map((cell) => ({ type: "place", cell }));
    case "SOS": return cells().flatMap((move) => (["S", "O"] as const).map((mark) => ({ ...move, mark })));
    case "ORDER_CHAOS": return cells().flatMap((move) => (["X", "O"] as const).map((mark) => ({ ...move, mark })));
    case "PENTAGO": return state.phase === "rotate" ? [0, 1, 2, 3].flatMap((quadrant) => ([-1, 1] as const).map((direction) => ({ type: "rotate" as const, quadrant, direction }))) : cells();
    default: return cells();
  }
}

export interface ArcadeCell { key: number; label: string; owner?: Side; move?: ArcadeMove; select?: number; coordinate?: string; muted?: boolean }
export interface ArcadeView { columns: number; cells: ArcadeCell[]; controls: { label: string; move: ArcadeMove }[]; info: string; markChoices?: ("S" | "O" | "X")[]; guess?: { min: number; max: number }; promotion?: boolean }
const CHESS_SYMBOLS = ["", "♙", "♘", "♗", "♖", "♕", "♔", "♟", "♞", "♝", "♜", "♛", "♚"];
const CARD_SYMBOLS = ["🌹", "☕", "🌙", "🍓", "🦋", "🎵", "🍿", "🌻"];

export function arcadeView(state: ArcadeState, side: Side, selected: number | null, mark: "S" | "O" | "X", promotion = "q"): ArcadeView {
  const legal = legalArcadeMoves(state, side);
  const view: ArcadeView = { columns: 0, cells: [], controls: [], info: "" };
  const put = (key: number, label: string, owner?: Side, move?: ArcadeMove): ArcadeCell => ({ key, label, owner, move });
  if (state.kind === "NIM") {
    view.info = arrayData(state, "piles").map((n, i) => `Pile ${i + 1}: ${"●".repeat(n) || "empty"}`).join(" · ");
    view.controls = legal.map((move) => ({ label: move.type === "take" ? `Pile ${move.pile + 1}: take ${move.count}` : "", move })); return view;
  }
  if (state.kind === "TAKE_21") view.info = `Total: ${numberData(state, "total")} / 21`;
  if (state.kind === "PIG") view.info = `Unbanked: ${numberData(state, "running")}${state.data.lastDie ? ` · Last roll: ${state.data.lastDie}` : ""}`;
  if (state.kind === "HIGHER_LOWER") { view.guess = { min: numberData(state, "low"), max: numberData(state, "high") }; view.info = `Secret number: ${view.guess.min}–${view.guess.max}`; return view; }
  if (state.kind === "ROCK_PAPER_SCISSORS") view.info = state.phase === "reveal" ? `Player 1: ${state.data.pick0} · Player 2: ${state.data.pick1}` : state.data[`pick${side}`] ? "Your choice is locked. Waiting for your partner." : "Both choose privately.";
  if (["PIG", "TAKE_21", "ROCK_PAPER_SCISSORS"].includes(state.kind)) {
    view.controls = legal.map((move) => ({ move, label: move.type === "roll" ? "Roll die" : move.type === "hold" ? "Hold / bank points" : move.type === "continue" ? "Next round" : move.type === "choose" ? state.kind === "TAKE_21" ? `Add ${move.value}` : move.value : "" })); return view;
  }
  if (state.kind === "DOTS_BOXES") {
    view.columns = 7;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const key = y * 7 + x;
      if (y % 2 === 0 && x % 2 === 0) view.cells.push(put(key, "•"));
      else if (y % 2 && x % 2) { const owner = arrayData(state, "boxes")[Math.floor(y / 2) * 3 + Math.floor(x / 2)]; view.cells.push(put(key, owner ? `P${owner}` : "", owner ? (owner - 1) as Side : undefined)); }
      else { const edge = y % 2 === 0 ? (y / 2) * 3 + Math.floor(x / 2) : 12 + Math.floor(y / 2) * 4 + x / 2; const owner = state.board[edge]; view.cells.push(put(key, y % 2 ? "│" : "─", owner ? (owner - 1) as Side : undefined, legal.find((move) => move.type === "place" && move.cell === edge))); }
    }
    return view;
  }
  if (state.kind === "SNAKES_LADDERS") {
    view.columns = 10; view.info = `Positions: ${state.scores[0]} / ${state.scores[1]}${state.data.lastDie ? ` · Last roll: ${state.data.lastDie}` : ""}`;
    for (let y = 9; y >= 0; y--) for (let x = 0; x < 10; x++) {
      const number = y * 10 + (y % 2 ? 10 - x : x + 1), occupant = state.scores.indexOf(number);
      view.cells.push(put(number, `${number}${occupant >= 0 ? ` P${occupant + 1}` : ""}${SNAKES[number] ? SNAKES[number] > number ? "↗" : "↘" : ""}`, occupant >= 0 ? occupant as Side : undefined));
    }
    view.controls = legal.map((move) => ({ label: "Roll die", move })); return view;
  }
  const sizes: Record<string, number> = { GOMOKU: 9, REVERSI: 4, MEMORY: 4, BATTLESHIP: 5, CHESS: 8, CHECKERS: 8, MANCALA: 6, SOS: 3, ORDER_CHAOS: 6, HEX: 5, DOMINEERING: 6, CHOMP: 7, BREAKTHROUGH: 6, PENTAGO: 6 };
  view.columns = sizes[state.kind] ?? 6;
  const pieceMoving = ["CHESS", "CHECKERS", "BREAKTHROUGH"].includes(state.kind);
  if (state.kind === "CHESS") view.promotion = true;
  if (state.kind === "SOS") view.markChoices = ["S", "O"];
  if (state.kind === "ORDER_CHAOS") { view.markChoices = ["X", "O"]; view.info = `You are ${side === 0 ? "Order" : "Chaos"}.`; }
  if (state.kind === "HEX") view.info = side === 0 ? "Connect top to bottom." : "Connect left to right.";
  if (state.kind === "MEMORY" && state.phase === "reveal") view.controls = [{ label: "Turn cards back over", move: { type: "continue" } }];
  if (state.kind === "PENTAGO" && state.phase === "rotate") { view.info = "Rotate a quadrant to finish your turn."; view.controls = legal.map((move) => ({ move, label: move.type === "rotate" ? `Quadrant ${move.quadrant + 1} ${move.direction === 1 ? "↻" : "↺"}` : "" })); }
  if (state.kind === "BATTLESHIP") view.info = `Your fleet: ${arrayData(state, `fleet${side}`).map((n) => `${"ABCDE"[n % 5]}${Math.floor(n / 5) + 1}`).join(", ")}`;
  if (state.kind === "MANCALA") view.info = `Player 1's pits are the bottom row; player 2's pits are the top row. Stores: ${state.scores[0]} / ${state.scores[1]}`;
  const indexes = state.kind === "MANCALA" ? [12,11,10,9,8,7,0,1,2,3,4,5] : Array.from({ length: state.kind === "BATTLESHIP" ? 25 : state.board.length }, (_, n) => n);
  view.cells = indexes.map((cell) => {
    const value = state.kind === "BATTLESHIP" ? state.board[side * 25 + cell] : state.board[cell];
    let label = value ? "●" : "", owner: Side | undefined = value ? (value - 1) as Side : undefined;
    if (state.kind === "CHESS") { label = CHESS_SYMBOLS[value]; owner = value ? value > 6 ? 1 : 0 : undefined; }
    if (state.kind === "CHECKERS") { label = value > 2 ? "♛" : value ? "●" : ""; owner = value ? value % 2 ? 0 : 1 : undefined; }
    if (state.kind === "BREAKTHROUGH") label = value ? "♟" : "";
    if (state.kind === "SOS" || state.kind === "ORDER_CHAOS") { label = value ? value === 1 ? state.kind === "SOS" ? "S" : "X" : "O" : ""; owner = undefined; }
    if (state.kind === "MEMORY") { const symbol = arrayData(state, "deck")[cell]; label = symbol >= 0 ? CARD_SYMBOLS[symbol] : "?"; }
    if (state.kind === "BATTLESHIP") { label = value === 2 ? "✹" : value === 1 ? "·" : ""; owner = value === 2 ? side : undefined; }
    if (state.kind === "CHOMP") { label = value ? "" : cell === 0 ? "☠" : "🍪"; owner = undefined; }
    if (state.kind === "MANCALA") { label = String(value); owner = cell < 6 ? 0 : 1; }
    const legalCell = legal.find((move) => move.type === "place" && move.cell === cell && (!move.mark || move.mark === mark));
    const destination = legal.find((move) => move.type === "move" && move.from === selected && move.to === cell && (!move.promotion || move.promotion === promotion));
    return { key: cell, label, owner, move: pieceMoving ? destination : legalCell,
      select: pieceMoving && legal.some((move) => move.type === "move" && move.from === cell) ? cell : undefined,
      coordinate: `${"ABCDEFGHI"[cell % view.columns]}${state.kind === "CHESS" ? 8 - Math.floor(cell / 8) : Math.floor(cell / view.columns) + 1}`,
      muted: state.kind === "CHOMP" && Boolean(value) };
  });
  return view;
}
