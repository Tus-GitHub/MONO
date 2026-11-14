import { describe, expect, it } from "vitest";
import { GAME_LABEL, newGame, parseGame, playGame, movableTokens, type GameKind, type GameMove, type GameState, type Player } from "./games";
import { publicArcade, createArcade } from "./arcade";
import { legalArcadeMoves, arcadeView, GAME_RULES } from "./arcade-view";
import { arrayData, type ArcadeState } from "./arcade-state";

function random(seed = 123456) { let value = seed; return (max: number) => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value % max; }; }
const kinds = Object.keys(GAME_LABEL) as GameKind[];
function moves(state: GameState, side: Player): GameMove[] {
  if (state.type === "ARCADE") return legalArcadeMoves(state, side);
  if (state.type === "LUDO") return state.die ? movableTokens(state).map((token) => ({ type: "token", token })) : [{ type: "roll" }];
  if (state.type === "TIC_TAC_TOE") return state.board.flatMap((value, cell) => value == null ? [{ type: "place" as const, cell }] : []);
  return state.board.slice(0, 7).flatMap((value, cell) => value == null ? [{ type: "place" as const, cell }] : []);
}

it("registers 24 real games with rules and valid initial states", () => {
  expect(kinds).toHaveLength(24);
  for (const kind of kinds) {
    const state = newGame(kind, random());
    expect(parseGame(kind, JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(GAME_RULES[kind].length).toBeGreaterThan(30);
    expect(moves(state, 0).length).toBeGreaterThan(0);
  }
});
describe.each(kinds)("%s", (kind) => {
  it("is playable through a complete match, with immutable moves and serialized state", () => {
    const rng = random(kinds.indexOf(kind) + 613), nextDie = random(kinds.indexOf(kind) + 1321);
    let state = newGame(kind, rng), outcome: Player | "draw" | undefined;
    let turns = 0;
    while (outcome === undefined && turns++ < 8000) {
      let side = state.turn;
      if (state.type === "ARCADE" && kind === "ROCK_PAPER_SCISSORS") side = state.phase === "reveal" || !state.data.pick0 ? 0 : 1;
      const legal = moves(state, side);
      expect(legal.length, `${kind} has no legal action at turn ${turns}`).toBeGreaterThan(0);
      let action = legal[rng(legal.length)];
      if (state.type === "ARCADE") {
        const view = arcadeView(publicArcade(state, side), side, null, kind === "SOS" ? "S" : "X");
        expect(view.info.length + view.cells.length + view.controls.length + (view.guess ? 1 : 0)).toBeGreaterThan(0);
        if (kind === "ROCK_PAPER_SCISSORS" && state.phase !== "reveal") action = { type: "choose", value: side === 0 ? "rock" : "scissors" };
        if (kind === "HIGHER_LOWER") action = { type: "guess", value: Math.floor((Number(state.data.low) + Number(state.data.high)) / 2) };
        if (kind === "MEMORY" && state.phase !== "reveal") {
          const first = Number(state.data.first), deck = arrayData(state, "deck");
          action = first < 0 ? legal[0] : legal.find((move) => move.type === "place" && deck[move.cell] === deck[first]) ?? legal[0];
        }
        if (kind === "PIG" && Number(state.data.running) >= 12) action = { type: "hold" };
      }
      if (state.type === "LUDO" && state.die) { const tokens = state.tokens[side]; action = legal.sort((a, b) => (b.type === "token" ? tokens[b.token] : -2) - (a.type === "token" ? tokens[a.token] : -2))[0]; }
      const before = JSON.stringify(state);
      const result = playGame(state, side, action, action.type === "roll" ? nextDie(6) + 1 : undefined);
      expect(JSON.stringify(state)).toBe(before);
      state = parseGame(kind, JSON.parse(JSON.stringify(result.state))); outcome = result.outcome;
    }
    expect(outcome, `${kind} did not terminate in ${turns} turns`).not.toBeUndefined();
    expect([0, 1, "draw"]).toContain(outcome);
  }, 60_000);
});

it("enforces turn order, occupied squares, a real tic-tac-toe win and no later moves", () => {
  let state = newGame("TIC_TAC_TOE", random());
  expect(() => playGame(state, 1, { type: "place", cell: 0 })).toThrow(/partner/);
  for (const [side, cell] of [[0,0],[1,3],[0,1],[1,4]] as const) state = playGame(state, side, { type: "place", cell }).state;
  expect(() => playGame(state, 0, { type: "place", cell: 0 })).toThrow();
  const won = playGame(state, 0, { type: "place", cell: 2 }); expect(won.outcome).toBe(0);
  expect(() => playGame(won.state, 1, { type: "place", cell: 8 })).toThrow(/finished/);
});
it("requires a six to leave Ludo home, an exact finish, and respects safe squares", () => {
  const state = parseGame("LUDO", { type: "LUDO", tokens: [[56,-1,-1,-1],[30,-1,-1,-1]], turn: 0, die: 2 });
  expect(state.type).toBe("LUDO");
  if (state.type !== "LUDO") throw new Error();
  expect(movableTokens(state)).toEqual([]);
  state.die = 6; expect(movableTokens(state)).toEqual([1,2,3]);
  state.tokens[0] = [7,-1,-1,-1]; state.tokens[1] = [34,-1,-1,-1]; state.die = 1;
  const safe = playGame(state, 0, { type: "token", token: 0 }).state;
  expect(safe.type === "LUDO" && safe.tokens[1][0]).toBe(34);
});
it("keeps secrets out of each player's DTO and refuses choice changes after commitment", () => {
  for (const kind of ["MEMORY", "BATTLESHIP", "HIGHER_LOWER", "ROCK_PAPER_SCISSORS"] as const) {
    const state = createArcade(kind, random());
    for (const side of [0,1] as const) {
      const view = publicArcade(state, side);
      if (kind === "MEMORY") expect(view.data.deck).toEqual(Array(16).fill(-1));
      if (kind === "BATTLESHIP") expect(view.data[`fleet${side === 0 ? 1 : 0}`]).toBeUndefined();
      if (kind === "HIGHER_LOWER") expect(view.data.secret).toBeUndefined();
    }
  }
  const chosen = playGame(createArcade("ROCK_PAPER_SCISSORS", random()), 0, { type: "choose", value: "rock" }).state as ArcadeState;
  expect(publicArcade(chosen, 1).data.pick0).toBe("hidden");
  expect(() => playGame(chosen, 0, { type: "choose", value: "paper" })).toThrow();
});
it("enforces chess king safety and retains threefold repetition across persisted turns", () => {
  let state: GameState = createArcade("CHESS", random());
  expect(() => playGame(state, 0, { type: "move", from: 60, to: 44 })).toThrow(/legal/);
  let outcome;
  for (let round = 0; round < 2; round++) for (const [side, from, to] of [[0,62,45],[1,6,21],[0,45,62],[1,21,6]] as const) {
    const result = playGame(state, side, { type: "move", from, to }); state = parseGame("CHESS", JSON.parse(JSON.stringify(result.state))); outcome = result.outcome;
  }
  expect(outcome).toBe("draw");
});
it("labels chess squares by their real rank and offers the selected pawn's legal destinations", () => {
  const state = createArcade("CHESS", random());
  const view = arcadeView(state, 0, 52, "X");
  expect(view.cells[0].coordinate).toBe("A8");
  expect(view.cells[52].coordinate).toBe("E2");
  expect(view.cells[36].coordinate).toBe("E4");
  expect(view.cells[36].move).toEqual({ type: "move", from: 52, to: 36 });
  expect(view.cells[28].move).toBeUndefined();
});
