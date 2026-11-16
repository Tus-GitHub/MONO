"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { SOLO_GAMES, type SoloKind, type SoloChallenge, type SoloReplay, type SoloScore } from "@/lib/solo-games/catalog";
import { GameRound } from "./game-round";

interface PendingScore { token: string; replay: SoloReplay; score: number }
export function SoloGameScreen({ kind, userId, scores }: { kind: SoloKind; userId: string; scores: SoloScore[] }) {
  const game = SOLO_GAMES[kind], initialBest = scores.find(s => s.kind === kind && s.userId === userId)?.bestScore ?? 0;
  const [best, setBest] = useState(initialBest), [challenge, setChallenge] = useState<SoloChallenge | null>(null);
  const [starting, setStarting] = useState(false), [error, setError] = useState(""), [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const bestRef = useRef(initialBest), pending = useRef<PendingScore | null>(null), saving = useRef(false), startingRef = useRef(false);
  const lastAttempt = useRef(0);
  const save = useCallback(async (immediate = false) => {
    if (saving.current || !pending.current) return;
    if (!immediate && Date.now() - lastAttempt.current < 1000) return;
    lastAttempt.current = Date.now();
    const item = pending.current; saving.current = true; setSaveStatus("Saving best…"); setSaveError("");
    try {
      const result = await togetherFetch<{ bestScore: number }>("/api/together/solo", { body: { action: "save", token: item.token, ...item.replay } });
      bestRef.current = Math.max(bestRef.current, result.bestScore); setBest(bestRef.current);
      if (pending.current === item || (pending.current && pending.current.score <= bestRef.current)) pending.current = null;
      setSaveStatus(pending.current ? "Saving best…" : "Best score saved");
    } catch (error) { setSaveError(errorMessage(error)); setSaveStatus("Score not saved yet"); }
    finally { saving.current = false; }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void save(); }, 1500);
    const retry = () => void save();
    window.addEventListener("online", retry); document.addEventListener("visibilitychange", retry);
    return () => { clearInterval(timer); window.removeEventListener("online", retry); document.removeEventListener("visibilitychange", retry); };
  }, [save]);
  const start = async () => {
    if (startingRef.current) return;
    startingRef.current = true; setStarting(true); setError("");
    try { setChallenge(await togetherFetch<SoloChallenge>("/api/together/solo", { body: { action: "start", kind } })); }
    catch (error) { setError(errorMessage(error)); }
    finally { startingRef.current = false; setStarting(false); }
  };
  const record = useCallback((replay: SoloReplay, score: number, immediate = false) => {
    if (!challenge || score <= bestRef.current || (pending.current && score < pending.current.score)) return;
    pending.current = { token: challenge.token, replay, score }; setSaveStatus("Saving best…");
    void save(immediate);
  }, [challenge, save]);
  return <PageContainer width="narrow" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><LinkButton href="/games" variant="ghost" size="sm">← All games</LinkButton><LinkButton href="/games/scores" variant="ghost" size="sm">High scores</LinkButton></div>
    <header><h1 className="font-display text-3xl text-ink"><span aria-hidden="true">{game.emoji} </span>{game.name}</h1><p className="mt-2 text-sm text-muted">{game.description}</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"><p className="text-sm text-muted">Your best <output aria-label="Saved highest score" className="ml-2 font-semibold tabular-nums text-primary">{best.toLocaleString()}</output></p><p role="status" className="text-xs text-muted">{saveStatus || "Saved to your account"}</p></div>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {saveError ? <div role="alert" className="rounded-lg border border-error/30 bg-error-tint p-3 text-sm text-error">{saveError} Your round is kept here for retry. <Button variant="link" onClick={() => void save()}>Retry save</Button></div> : null}
    {challenge ? <GameRound key={challenge.token} challenge={challenge} onRecord={record} onRestart={() => void start()} starting={starting} /> : <div className="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface px-5 py-10 text-center">
      <span aria-hidden="true" className="text-5xl">{game.emoji}</span><p className="max-w-sm text-sm text-muted">{kind === "EMOJI_BOUNCE" ? "Move the paddle left and right. Every catch earns a point, and the emoji gradually speeds up." : kind === "SNAKE" ? "Use swipes, arrow buttons or keyboard arrows. Each heart earns 10 points." : "Swipe or use the arrow buttons to slide. Equal tiles merge once per move and add to your score."}</p>
      <Button loading={starting} onClick={() => void start()}>Play {game.name}</Button>
    </div>}
  </PageContainer>;
}
