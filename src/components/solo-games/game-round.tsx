"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { SOLO_GAMES, type Direction, type SoloChallenge, type SoloReplay } from "@/lib/solo-games/catalog";
import { BOUNCE, clampPaddle } from "@/lib/solo-games/emoji-bounce";
import { SNAKE_SIZE } from "@/lib/solo-games/snake";
import { advanceSoloRound, createSoloRound, type SoloRound } from "@/lib/solo-games/engine";
import { restoreSoloRound } from "@/lib/solo-games/replay";

const keys: Record<string, Direction | undefined> = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
const directions = [{ value: 0, label: "up", arrow: "↑" }, { value: 3, label: "left", arrow: "←" }, { value: 2, label: "down", arrow: "↓" }, { value: 1, label: "right", arrow: "→" }] as const;
type Phase = "running" | "paused" | "over";
export function GameRound({ challenge, restore, onRecord, onRestart, starting }: {
  challenge: SoloChallenge; onRecord: (replay: SoloReplay, score: number, immediate?: boolean) => void;
  onRestart: () => void; starting: boolean; restore?: SoloReplay;
}) {
  const [view, setView] = useState(() => restore ? restoreSoloRound(challenge.kind, challenge.seed, restore, challenge.rulesVersion ?? 1) : createSoloRound(challenge.kind, challenge.seed, challenge.rulesVersion ?? 1));
  const round = useRef(view), inputs = useRef<[number, number][]>(restore?.moves.slice() ?? []);
  const lastInput = restore?.moves.at(-1)?.[1] ?? (challenge.kind === "EMOJI_BOUNCE" ? 180 : 1);
  const input = useRef(lastInput), previousInput = useRef(lastInput);
  const horizontal = useRef(0), field = useRef<HTMLDivElement>(null), swipe = useRef<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<Phase>(view.state.over ? "over" : restore ? "paused" : "running");
  const phaseRef = useRef<Phase>(phase);
  const setMode = useCallback((next: Phase) => { phaseRef.current = next; horizontal.current = 0; setPhase(next); }, []);
  const capture = useCallback((immediate = false) => {
    const state = round.current.state;
    onRecord({ frames: state.frame, moves: inputs.current.slice() }, state.score, immediate);
  }, [onRecord]);
  const advance = useCallback((value: number) => {
    const before = round.current;
    if (before.state.over || phaseRef.current !== "running") return;
    const next = advanceSoloRound(before, value);
    if (next === before) return;
    if (before.kind === "MERGE_2048" || previousInput.current !== value) {
      inputs.current.push([before.state.frame, value]); previousInput.current = value;
    }
    round.current = next; setView(next);
    if (next.state.score > before.state.score || next.kind === "MERGE_2048" || next.state.frame % (next.kind === "EMOJI_BOUNCE" ? 60 : 8) === 0) capture();
    if (next.state.over) { setMode("over"); capture(true); }
  }, [capture, setMode]);
  const pause = useCallback(() => {
    if (phaseRef.current !== "running") return;
    setMode("paused"); capture(true);
  }, [capture, setMode]);
  useEffect(() => {
    field.current?.focus({ preventScroll: true });
    const reveal = requestAnimationFrame(() => field.current?.scrollIntoView({ block: "center", behavior: "instant" }));
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener("blur", pause); window.addEventListener("pagehide", pause); document.addEventListener("visibilitychange", hidden);
    return () => { cancelAnimationFrame(reveal); window.removeEventListener("blur", pause); window.removeEventListener("pagehide", pause); document.removeEventListener("visibilitychange", hidden); };
  }, [pause]);
  useEffect(() => {
    if (phase !== "running" || challenge.kind === "MERGE_2048") return;
    let id = 0, last = 0, pending = 0;
    const stepMs = challenge.kind === "EMOJI_BOUNCE" ? 1000 / BOUNCE.hz : 125;
    const tick = (now: number) => {
      if (phaseRef.current !== "running") return;
      if (last) pending += Math.min(now - last, 100); last = now;
      while (pending >= stepMs && phaseRef.current === "running") {
        if (challenge.kind === "EMOJI_BOUNCE") input.current = clampPaddle(input.current + horizontal.current * 6);
        advance(input.current); pending -= stepMs;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase, challenge.kind, advance]);
  const move = (direction: Direction) => {
    if (phaseRef.current !== "running") return;
    if (challenge.kind === "MERGE_2048") advance(direction);
    else input.current = direction;
  };
  const resume = () => { setMode("running"); field.current?.focus({ preventScroll: true }); };
  const positionPaddle = (clientX: number) => {
    const box = field.current?.getBoundingClientRect();
    if (box?.width) input.current = clampPaddle((clientX - box.left) / box.width * BOUNCE.width);
  };
  return <section aria-label={`${SOLO_GAMES[challenge.kind].name} round`} className="space-y-4">
    <div className="sticky top-[calc(var(--appheader-h)+var(--safe-top))] z-10 flex flex-wrap items-center justify-between gap-3 bg-paper">
      <p className="text-sm text-muted">Score <output aria-label="Current score" className="ml-2 font-display text-3xl tabular-nums text-ink">{view.state.score.toLocaleString()}</output></p>
      <div className="flex gap-2">{phase === "running" ? <Button size="sm" variant="secondary" onClick={pause}>Pause</Button> : null}
        {phase === "paused" ? <Button size="sm" variant="secondary" loading={starting} onClick={onRestart}>Restart</Button> : null}</div>
    </div>
    <div ref={field} tabIndex={0} role="group" aria-label={`${SOLO_GAMES[challenge.kind].name} game board`}
      className={cn("solo-game-board relative mx-auto touch-none overflow-hidden rounded-xl border border-line bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring", challenge.kind === "EMOJI_BOUNCE" ? "solo-game-board-tall" : "solo-game-board-square")}
      onKeyDown={event => {
        const direction = keys[event.key];
        if (direction == null) { if (event.key === "Escape") { event.preventDefault(); pause(); } return; }
        event.preventDefault();
        if (challenge.kind === "EMOJI_BOUNCE") { if (direction === 1 || direction === 3) { horizontal.current = direction === 1 ? 1 : -1; input.current = clampPaddle(input.current + horizontal.current * 12); } }
        else move(direction);
      }} onKeyUp={event => { if (keys[event.key] === 1 || keys[event.key] === 3) horizontal.current = 0; }}
      onPointerDown={event => {
        if (phaseRef.current !== "running") return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        swipe.current = { x: event.clientX, y: event.clientY };
        if (challenge.kind === "EMOJI_BOUNCE") positionPaddle(event.clientX);
      }} onPointerMove={event => { if (challenge.kind === "EMOJI_BOUNCE" && phaseRef.current === "running") positionPaddle(event.clientX); }}
      onPointerUp={event => {
        if (challenge.kind !== "EMOJI_BOUNCE" && swipe.current) {
          const dx = event.clientX - swipe.current.x, dy = event.clientY - swipe.current.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 16) move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : 3 : dy > 0 ? 2 : 0);
        }
        swipe.current = null;
      }} onPointerCancel={() => { swipe.current = null; horizontal.current = 0; }}>
      <Board round={view} />
      {phase !== "running" ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/90 p-5 text-center backdrop-blur-sm">
        <p role="status" className="font-display text-2xl text-ink">{phase === "paused" ? "Paused" : "Round complete"}</p>
        <p className="text-sm text-muted">{phase === "paused" ? "Resume this round when you're ready." : `${view.state.score.toLocaleString()} ${view.state.score === 1 ? "point" : "points"}. Ready to beat that?`}</p>
        {phase === "paused" ? <Button onClick={resume}>Resume</Button> : <Button loading={starting} onClick={onRestart}>Play again</Button>}
      </div> : null}
    </div>
    {challenge.kind !== "EMOJI_BOUNCE" ? <div aria-label="Directional controls" className="mx-auto grid w-fit grid-cols-3 gap-2">
      {directions.map(({ value, label, arrow }, index) => <Button key={value} aria-label={`Move ${label}`} variant="secondary" className={index === 0 ? "col-start-2" : index === 1 ? "col-start-1 row-start-2" : "row-start-2"} disabled={phase !== "running"} onClick={() => move(value)}>{arrow}</Button>)}
    </div> : null}
    <p className="text-center text-xs text-muted">{challenge.kind === "EMOJI_BOUNCE" ? "Drag or move your finger below the emoji. On a laptop, use your mouse or ← → keys." : "Swipe the board, tap the arrows or use your keyboard. Esc pauses."}</p>
  </section>;
}

function Board({ round }: { round: SoloRound }) {
  if (round.kind === "EMOJI_BOUNCE") return <svg viewBox={`0 0 ${BOUNCE.width} ${BOUNCE.height}`} aria-hidden="true" className="block size-full">
    <path d="M1 475V1H359V475" fill="none" className="stroke-primary/30" strokeWidth="3" />
    <path d="M0 519H360" className="stroke-error/70" strokeWidth="3" strokeDasharray="8 8" />
    <text x={round.state.x} y={round.state.y} textAnchor="middle" dominantBaseline="central" fontSize="28">🥰</text>
    <rect x={round.state.paddle - BOUNCE.paddleWidth / 2} y={BOUNCE.paddleY} width={BOUNCE.paddleWidth} height={BOUNCE.paddleHeight} rx="5" className="fill-primary" />
  </svg>;
  if (round.kind === "SNAKE") return <svg viewBox={`0 0 ${SNAKE_SIZE} ${SNAKE_SIZE}`} aria-hidden="true" className="block size-full">
    {round.state.food >= 0 ? <text x={round.state.food % SNAKE_SIZE + 0.5} y={Math.floor(round.state.food / SNAKE_SIZE) + 0.57} textAnchor="middle" dominantBaseline="central" fontSize="0.8">♥️</text> : null}
    {round.state.body.map((cell, i) => <rect key={cell} x={cell % SNAKE_SIZE + 0.06} y={Math.floor(cell / SNAKE_SIZE) + 0.06} width="0.88" height="0.88" rx="0.2" className={i === 0 ? "fill-primary" : "fill-primary/60"} />)}
  </svg>;
  return <div className="grid size-full grid-cols-4 grid-rows-4 gap-2 p-2" aria-label="2048 tiles">{round.state.board.map((n, i) => <div key={i} className={cn("solo-number-tile flex min-w-0 items-center justify-center rounded-lg font-semibold tabular-nums", n >= 2048 ? "bg-accent text-accent-fg" : n >= 128 ? "bg-primary text-primary-fg" : n >= 8 ? "bg-primary-tint text-primary" : n ? "bg-line text-ink" : "bg-paper")}><span>{n || ""}</span></div>)}</div>;
}
