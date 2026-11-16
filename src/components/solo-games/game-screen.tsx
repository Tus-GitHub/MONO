"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { togetherFetch, errorMessage, transientTogetherError } from "@/lib/together/client";
import { SOLO_GAMES, SOLO_RULES_VERSION, type SoloKind, type SoloChallenge, type SoloReplay, type SoloScore } from "@/lib/solo-games/catalog";
import { acknowledgeSoloDraft, checkpointSoloDraft, emptySoloDraft, readSoloDraft, soloDraftBest, soloDraftKey, soloStorage, writeSoloDraft, type SoloDraft, type SoloStorage } from "@/lib/solo-games/recovery";
import { GameRound } from "./game-round";

export function SoloGameScreen({ kind, userId, coupleId, scores }: { kind: SoloKind; userId: string; coupleId: string; scores: SoloScore[] }) {
  const game = SOLO_GAMES[kind], initialBest = scores.find(s => s.kind === kind && s.userId === userId)?.bestScore ?? 0;
  const storageKey = soloDraftKey(coupleId, userId, kind);
  const [best, setBest] = useState(initialBest), [session, setSession] = useState<{ challenge: SoloChallenge; restore?: SoloReplay } | null>(null);
  const [ready, setReady] = useState(false), [starting, setStarting] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState(""), [saveStatus, setSaveStatus] = useState(""), [backedUp, setBackedUp] = useState(true);
  const draft = useRef(emptySoloDraft()), storage = useRef<SoloStorage | null>(null), saving = useRef(false), startingRef = useRef(false);
  const nextAttempt = useRef(0), failures = useRef(0);
  const hydratedKey = useRef<string | null>(null);
  const persist = useCallback((next: SoloDraft) => {
    draft.current = next;
    setBackedUp(writeSoloDraft(storage.current, storageKey, next));
    setBest(soloDraftBest(next));
  }, [storageKey]);
  const save = useCallback(async (immediate = false) => {
    if (saving.current || !draft.current.pending || (!immediate && Date.now() < nextAttempt.current)) return;
    if (!navigator.onLine) { setSaveStatus("Saved on device · offline"); return; }
    const item = draft.current.pending; saving.current = true; nextAttempt.current = Date.now() + 1500;
    setSaveStatus("Syncing best…");
    try {
      const result = await togetherFetch<{ bestScore: number }>("/api/together/solo", { body: { action: "save", token: item.challenge.token, ...item.replay } });
      persist(acknowledgeSoloDraft(draft.current, result.bestScore));
      failures.current = 0; setNotice("");
      setSaveStatus(draft.current.pending ? "Syncing best…" : "Best score saved");
    } catch (error) {
      const transient = transientTogetherError(error);
      failures.current += 1;
      nextAttempt.current = transient ? Date.now() + Math.min(30_000, 2000 * 2 ** Math.min(failures.current, 4)) : Infinity;
      setSaveStatus("Waiting to sync");
      setNotice(transient ? "Connection interrupted. Keep playing; your best will sync automatically when the connection returns." : `${errorMessage(error)} Your current score is kept here. Retry after signing in or reconnecting.`);
    } finally { saving.current = false; }
  }, [persist]);
  useEffect(() => {
    if (hydratedKey.current === storageKey) { persist(acknowledgeSoloDraft(draft.current, initialBest)); return; }
    hydratedKey.current = storageKey;
    storage.current = soloStorage();
    const recovered = acknowledgeSoloDraft(readSoloDraft(storage.current, storageKey, kind), initialBest);
    persist(recovered);
    if (recovered.round) {
      setSession({ challenge: recovered.round.challenge, restore: recovered.round.replay });
      setSaveStatus(recovered.pending ? "Saved on device · syncing" : "Round restored");
    }
    setReady(true); void save(true);
  }, [storageKey, kind, initialBest, persist, save]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void save(); }, 1500);
    const online = () => { nextAttempt.current = 0; void save(true); };
    const visible = () => { if (!document.hidden) void save(); };
    window.addEventListener("online", online); document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visible); };
  }, [save]);
  const start = async () => {
    if (startingRef.current || !ready) return;
    if (!navigator.onLine) { setError("Reconnect to start a new round. Your current progress is kept."); return; }
    startingRef.current = true; setStarting(true); setError(""); void save(true);
    try {
      const challenge = await togetherFetch<SoloChallenge>("/api/together/solo", { body: { action: "start", kind, rulesVersion: SOLO_RULES_VERSION } });
      persist(checkpointSoloDraft(draft.current, { challenge, replay: { frames: 0, moves: [] }, score: 0, savedAt: Date.now() }));
      setSession({ challenge });
    } catch (error) { setError(errorMessage(error)); }
    finally { startingRef.current = false; setStarting(false); }
  };
  const record = useCallback((replay: SoloReplay, score: number, immediate = false) => {
    if (!session) return;
    persist(checkpointSoloDraft(draft.current, { challenge: session.challenge, replay, score, savedAt: Date.now() }));
    if (draft.current.pending) void save(immediate);
  }, [session, persist, save]);
  return <PageContainer width="narrow" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><LinkButton href="/games" variant="ghost" size="sm">← All games</LinkButton><LinkButton href="/games/scores" variant="ghost" size="sm">High scores</LinkButton></div>
    <header><h1 className="font-display text-3xl text-ink"><span aria-hidden="true">{game.emoji} </span>{game.name}</h1><p className="mt-2 text-sm text-muted">{game.description}</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"><p className="text-sm text-muted">Your best <output aria-label="Highest score" className="ml-2 font-semibold tabular-nums text-primary">{best.toLocaleString()}</output></p><p role="status" className="text-xs text-muted">{!backedUp && saveStatus.includes("device") ? "Waiting to sync" : saveStatus || "Saved to your account"}</p></div>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {session ? <GameRound key={session.challenge.token} challenge={session.challenge} restore={session.restore} onRecord={record} onRestart={() => void start()} starting={starting} /> : <div className="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface px-5 py-10 text-center">
      <span aria-hidden="true" className="text-5xl">{game.emoji}</span><p className="max-w-sm text-sm text-muted">{kind === "EMOJI_BOUNCE" ? "Move the paddle left and right. Every catch earns a point, and the emoji gradually speeds up." : kind === "SNAKE" ? "Use swipes, arrow buttons or keyboard arrows. Each heart earns 10 points." : "Swipe or use the arrow buttons to slide. Equal tiles merge once per move and add to your score."}</p>
      <Button disabled={!ready} loading={starting} onClick={() => void start()}>Play {game.name}</Button>
    </div>}
    {notice ? <div role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">{notice} <Button variant="link" onClick={() => void save(true)}>Retry save</Button></div> : null}
    {!backedUp && session ? <p role="alert" className="text-sm text-error">This browser could not keep a device backup. Keep this page open until your best score is saved to your account.</p> : null}
  </PageContainer>;
}
