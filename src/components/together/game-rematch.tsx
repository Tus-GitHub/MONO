"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { GAME_LABEL } from "@/lib/together/games";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { GameDTO } from "@/lib/together/types";

export function rematchPending(game: GameDTO) {
  return !!game.rematchRequestedById && !!game.rematchRequestedAt && !game.rematchGameId && Date.now() - new Date(game.rematchRequestedAt).getTime() < 5 * 60_000;
}

export function RematchPrompt({ games, userId, partnerName, refresh, onOpen }: {
  games: GameDTO[]; userId: string; partnerName: string; refresh: () => Promise<void>; onOpen: (id: string) => void;
}) {
  const game = games.find(row => row.status === "FINISHED" && row.rematchRequestedById !== userId && rematchPending(row));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const nextGame = useRef<string | null>(null), pending = useRef(false);
  const requestId = game ? `${game.id}:${game.version}` : null;
  const answer = async (accept: boolean) => {
    if (!game || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await togetherFetch<GameDTO>("/api/together/games", { body: { action: accept ? "rematch-accept" : "rematch-decline", id: game.id, version: game.version } });
      nextGame.current = accept ? result.rematchGameId ?? null : null;
      setDismissed(requestId); await refresh();
    } catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Modal open={!!game && dismissed !== requestId} title="One more round?" description={game ? `${partnerName} wants a rematch of ${GAME_LABEL[game.kind]}.` : undefined}
    onClose={() => { if (!busy) void answer(false); }}
    onHistoryClosed={(stayed) => { const id = nextGame.current; nextGame.current = null; if (stayed && id) onOpen(id); }}>
    <p className="text-sm text-muted">A fresh board, with the starting player switched. Your previous score stays saved.</p>
    {error ? <p role="alert" className="mt-3 text-sm text-error">{error}</p> : null}
    <div className="mt-5 flex flex-wrap gap-3"><Button loading={busy} onClick={() => void answer(true)}>Accept rematch</Button><Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>Not now</Button></div>
  </Modal>;
}

export function GameOutcome({ game, userId, partnerName, userName, busy, onRequest, onCancel, onOpen }: {
  game: GameDTO; userId: string; partnerName: string; userName: string; busy: boolean;
  onRequest: () => void; onCancel: () => void; onOpen: () => void;
}) {
  const pending = rematchPending(game), mine = game.rematchRequestedById === userId;
  const [open, setOpen] = useState(() => !game.rematchGameId && !pending && Date.now() - new Date(game.updatedAt).getTime() < 60_000);
  const title = game.winnerId ? `${game.winnerId === userId ? userName : partnerName} wins!` : "It's a draw!";
  const nextAction = useRef<(() => void) | null>(null);
  useEffect(() => { if (pending || game.rematchGameId) { queueMicrotask(() => setOpen(false)); } }, [pending, game.rematchGameId]);
  const controls = game.rematchGameId ? <Button onClick={onOpen}>Open rematch</Button> : pending ? mine
    ? <div className="space-y-2"><p role="status" className="text-sm text-muted">Waiting for {partnerName} to accept…</p><Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel rematch</Button></div>
    : <p className="text-sm text-muted">{partnerName} asked for another round.</p>
    : <Button disabled={busy} onClick={onRequest}>Play again</Button>;
  return <>
    {controls}
    <Modal open={open && !pending && !game.rematchGameId} onClose={() => setOpen(false)} title={title} description={`${GAME_LABEL[game.kind]} · Score saved`}
      onHistoryClosed={(stayed) => { const action = nextAction.current; nextAction.current = null; if (stayed) action?.(); }}>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div aria-hidden className="mono-game-celebration grid size-24 place-items-center rounded-full bg-primary-tint text-primary"><Icon name="sparkles" size="lg" /></div>
        <p className="text-sm text-muted">{game.winnerId === userId ? "That round is yours. Ready for another?" : game.winnerId ? "A little friendly competition. Fancy another round?" : "Evenly matched. Shall we settle it?"}</p>
        <div className="flex flex-wrap justify-center gap-3"><Button disabled={busy} onClick={() => { nextAction.current = onRequest; setOpen(false); }}>Play again</Button><Button variant="secondary" onClick={() => setOpen(false)}>Back to match</Button></div>
      </div>
    </Modal>
  </>;
}
