"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { arcadeView } from "@/lib/together/arcade-view";
import { movableTokens, ludoSquare, LUDO_SAFE, type GameMove, type LudoState, type Player } from "@/lib/together/games";
import type { GameDTO } from "@/lib/together/types";
import { cn } from "@/lib/utils/cn";

export default function GameBoard({ game, userId, busy, play }: { game: GameDTO; userId: string; busy: boolean; play: (move: GameMove) => void }) {
  const side: Player = game.playerOneId === userId ? 0 : 1, state = game.state;
  const [selected, setSelected] = useState<number | null>(null), [mark, setMark] = useState<"S" | "O" | "X">(game.kind === "SOS" ? "S" : "X");
  const [promotion, setPromotion] = useState("q"), [guess, setGuess] = useState("");
  const canPlay = game.status === "ACTIVE" && !busy && (state.turn === side || (state.type === "ARCADE" && state.kind === "ROCK_PAPER_SCISSORS"));
  if (state.type === "LUDO") return <LudoBoard state={state} side={side} canPlay={canPlay} play={play} />;
  if (state.type === "ARCADE") {
    const view = arcadeView(state, side, selected, mark, promotion);
    return <div className="space-y-4">
      {view.info ? <p className="text-sm text-muted">{view.info}</p> : null}
      {["DOTS_BOXES", "PIG", "ROCK_PAPER_SCISSORS", "MEMORY", "MANCALA", "SOS"].includes(game.kind) ? <p className="text-xs text-muted">Round points: Player 1 {state.scores[0]} · Player 2 {state.scores[1]}</p> : null}
      <div className="flex flex-wrap gap-3">
        {view.markChoices ? <label className="text-sm">Place a <Select aria-label="Symbol to place" value={mark} onChange={(event) => setMark(event.target.value as typeof mark)}>{view.markChoices.map((symbol) => <option key={symbol}>{symbol}</option>)}</Select></label> : null}
        {view.promotion ? <label className="text-sm">Pawn promotion<Select aria-label="Pawn promotion" value={promotion} onChange={(event) => setPromotion(event.target.value)}><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></Select></label> : null}
      </div>
      {view.cells.length ? <div className="mx-auto max-w-xl overflow-x-auto rounded-xl border border-line bg-paper p-2" role="group" aria-label={`${game.kind.replaceAll("_", " ")} board`}>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${view.columns}, minmax(var(--game-cell-min), 1fr))`, ...(game.kind === "HEX" ? { paddingRight: "calc(var(--game-cell-min) * 2)" } : {}) }}>
          {view.cells.map((cell, index) => <button key={cell.key} type="button" disabled={!canPlay || (!cell.move && cell.select == null)}
            aria-label={`${cell.coordinate ?? `Edge ${cell.key + 1}`} ${cell.label || "empty"}${cell.owner != null ? ` · Player ${cell.owner + 1}` : ""}`}
            aria-pressed={selected === cell.select && cell.select != null}
            onClick={() => { if (cell.move) play(cell.move); else if (cell.select != null) setSelected(cell.select); }}
            className={cn("grid aspect-square min-w-0 place-items-center rounded-md border text-sm transition-colors disabled:cursor-default sm:text-lg",
              cell.owner === 0 ? "border-primary/30 bg-primary-tint text-primary" : cell.owner === 1 ? "border-accent/30 bg-accent-tint text-accent" : "border-line bg-surface text-ink",
              cell.move && canPlay && "border-success bg-success-tint/50", selected === cell.select && cell.select != null && "ring-2 ring-primary", cell.muted && "opacity-25",
              game.kind === "CHESS" && "text-2xl sm:text-3xl", game.kind === "SNAKES_LADDERS" && "text-2xs sm:text-xs")}
            style={game.kind === "HEX" ? { clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)", transform: `translateX(${Math.floor(index / 5) * 50}%)` } : undefined}>
            {cell.label || (cell.move && canPlay ? "·" : "")}
          </button>)}
        </div>
      </div> : null}
      {view.guess ? <div className="flex gap-2"><Input type="number" aria-label="Your number guess" min={view.guess.min} max={view.guess.max} value={guess} onChange={(event) => setGuess(event.target.value)} placeholder={`${view.guess.min}–${view.guess.max}`} />
        <Button disabled={!canPlay || !guess || Number(guess) < view.guess.min || Number(guess) > view.guess.max} onClick={() => play({ type: "guess", value: Number(guess) })}>Guess</Button></div> : null}
      <div className="flex flex-wrap gap-2">{view.controls.map((control, index) => <Button key={index} variant="secondary" disabled={!canPlay} onClick={() => play(control.move)}>{control.label}</Button>)}</div>
      {["CHESS", "CHECKERS", "BREAKTHROUGH"].includes(game.kind) && canPlay ? <p className="text-xs text-muted">Select one of your pieces, then a highlighted destination. Narrow screens can scroll across the board.</p> : null}
    </div>;
  }
  const columns = state.type === "TIC_TAC_TOE" ? 3 : 7;
  return <div className="mx-auto max-w-md space-y-2">
    {state.type === "CONNECT_FOUR" ? <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, col) => <Button key={col} size="sm" variant="secondary" aria-label={`Drop in column ${col + 1}`} disabled={!canPlay || state.board[col] != null} onClick={() => play({ type: "place", cell: col })}>↓</Button>)}</div> : null}
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="group" aria-label={`${state.type === "TIC_TAC_TOE" ? "Tic-tac-toe" : "Connect Four"} board`}>
      {state.board.map((value, index) => <button key={index} type="button" aria-label={`Square ${index + 1}: ${value == null ? "empty" : value === 0 ? "X" : "O"}`}
        disabled={!canPlay || (state.type === "TIC_TAC_TOE" ? value != null : state.board[index % 7] != null)}
        onClick={() => play({ type: "place", cell: state.type === "TIC_TAC_TOE" ? index : index % 7 })}
        className={cn("grid aspect-square place-items-center rounded-xl border border-line bg-surface font-display text-4xl disabled:cursor-default",
          value === 0 && "bg-primary-tint text-primary", value === 1 && "bg-accent-tint text-accent")}>
        {state.type === "TIC_TAC_TOE" ? value == null ? "" : value === 0 ? "X" : "O" : value == null ? "·" : "●"}
      </button>)}
    </div>
  </div>;
}

const PATH: [number, number][] = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
function LudoBoard({ state, side, canPlay, play }: { state: LudoState; side: Player; canPlay: boolean; play: (move: GameMove) => void }) {
  const moves = movableTokens(state);
  const point = (owner: Player, index: number, progress: number): [number, number] => progress < 0
    ? [owner === 0 ? 2 + Math.floor(index / 2) * 2 : 10 + Math.floor(index / 2) * 2, owner === 0 ? 2 + index % 2 * 2 : 10 + index % 2 * 2]
    : progress < 52 ? PATH[ludoSquare(owner, progress)] : progress < 57 ? [7, owner === 0 ? progress - 51 : 65 - progress] : [7, 7];
  return <div className="space-y-4">
    <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-3">
      <svg viewBox="0 0 15 15" role="img" aria-label="Classic two-player Ludo board, four tokens each" className="w-full">
        <rect x=".1" y=".1" width="14.8" height="14.8" rx=".4" fill="var(--paper)" stroke="var(--line)" strokeWidth=".08" />
        <rect x=".5" y=".5" width="5" height="5" rx=".4" fill="var(--primary-tint)" />
        <rect x="9.5" y="9.5" width="5" height="5" rx=".4" fill="var(--accent-tint)" />
        {PATH.map(([row, col], index) => <g key={index}><rect x={col + .06} y={row + .06} width=".88" height=".88" rx=".1" fill={LUDO_SAFE.has(index) ? "var(--warning-tint)" : "var(--surface)"} stroke="var(--line)" strokeWidth=".04" />
          {LUDO_SAFE.has(index) ? <text x={col + .5} y={row + .67} textAnchor="middle" fontSize=".5" fill="var(--warning)">✦</text> : null}</g>)}
        {[0,1].flatMap((owner) => Array.from({ length: 5 }, (_, n) => <rect key={`${owner}-${n}`} x={owner === 0 ? n + 1.06 : 13.06 - n} y="7.06" width=".88" height=".88" rx=".1" fill={owner === 0 ? "var(--primary-tint)" : "var(--accent-tint)"} />))}
        <circle cx="7.5" cy="7.5" r="1" fill="var(--success-tint)" /><text x="7.5" y="7.75" textAnchor="middle" fontSize=".65" fill="var(--success)">♥</text>
        {([0,1] as const).flatMap((owner) => state.tokens[owner].map((progress, index) => { const [row,col] = point(owner,index,progress); const shift = progress >= 0 ? (index - 1.5) * .09 : 0; return <g key={`${owner}-${index}`}>
          <circle cx={col + .5 + shift} cy={row + .5 + shift} r=".36" fill={owner === 0 ? "var(--primary)" : "var(--accent)"} stroke="var(--elevated)" strokeWidth=".06" />
          <text x={col + .5 + shift} y={row + .65 + shift} textAnchor="middle" fontSize=".43" fill={owner === 0 ? "var(--primary-fg)" : "var(--accent-fg)"}>{index + 1}</text></g>; }))}
      </svg>
    </div>
    <p className="text-sm text-muted">You are Player {side + 1}. {state.die ? `Rolled ${state.die} — choose a highlighted token.` : state.lastRoll ? `Last roll: ${state.lastRoll}.` : "Roll a six to bring a token out."}</p>
    <div className="grid grid-cols-2 gap-2">{state.tokens[side].map((position, token) => <Button key={token} variant="secondary" disabled={!canPlay || !moves.includes(token)} onClick={() => play({ type: "token", token })}>
      Token {token + 1} · {position < 0 ? "Home" : position === 57 ? "Finished" : position < 52 ? `Step ${position + 1}` : "Home lane"}
    </Button>)}</div>
    <Button fullWidth disabled={!canPlay || state.die != null} onClick={() => play({ type: "roll" })}>Roll die</Button>
    <p className="text-xs text-muted">Finished: Player 1 {state.tokens[0].filter((n) => n === 57).length}/4 · Player 2 {state.tokens[1].filter((n) => n === 57).length}/4</p>
  </div>;
}
