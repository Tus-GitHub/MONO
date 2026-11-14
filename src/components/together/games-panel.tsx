"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search";
import { Icon } from "@/components/ui/icon";
import { GAME_LABEL, type GameKind, type GameMove } from "@/lib/together/games";
import { GAME_RULES } from "@/lib/together/arcade-view";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { GameDTO, ScoreDTO } from "@/lib/together/types";
import GameBoard from "./game-board";

export default function GamesPanel({ games, scores, userId, userName, partnerName, selectedId, onSelect, refresh, mode }: {
  games: GameDTO[]; scores: ScoreDTO[]; userId: string; userName: string; partnerName: string;
  selectedId: string | null; onSelect: (id: string | null) => void; refresh: () => Promise<void>; mode: "games" | "scores";
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [search, setSearch] = useState("");
  const [detail, setDetail] = useState<GameDTO | null>(null), [confirmResign, setConfirmResign] = useState(false);
  const latest = games.find((game) => game.id === selectedId), local = detail?.id === selectedId ? detail : null;
  const selected = local && (!latest || local.version > latest.version) ? local : latest ?? null;
  useEffect(() => {
    if (!selectedId || selected) return;
    let live = true;
    void togetherFetch<GameDTO>(`/api/together/games?id=${selectedId}`).then((game) => { if (live) setDetail(game); }).catch((error) => { if (live) setError(errorMessage(error)); });
    return () => { live = false; };
  }, [selectedId, selected]);
  const open = (id: string) => onSelect(id);
  const act = async (body: unknown) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const game = await togetherFetch<GameDTO>("/api/together/games", { body }); setDetail(game); onSelect(game.id); await refresh(); }
    catch (error) { setError(errorMessage(error)); await refresh().catch(() => {}); }
    finally { setBusy(false); setConfirmResign(false); }
  };
  if (mode === "scores") return <Scoreboard scores={scores} userId={userId} userName={userName} partnerName={partnerName} />;
  if (selected) {
    const side = selected.playerOneId === userId ? 0 : 1, currentName = selected.state.turn === side ? "Your turn" : `${partnerName}'s turn`;
    const status = selected.status === "WAITING" ? side === 0 ? `Waiting for ${partnerName}` : `${partnerName} invited you` : selected.status === "FINISHED"
      ? selected.winnerId ? selected.winnerId === userId ? "You won this match" : `${partnerName} won this match` : "This match was a draw"
      : selected.status === "ACTIVE" ? selected.kind === "ROCK_PAPER_SCISSORS" ? "Both choose privately" : currentName : selected.status === "CANCELLED" ? "Invitation cancelled" : "Invitation declined";
    const version = { id: selected.id, version: selected.version };
    return <div className="space-y-5">
      <Button variant="ghost" onClick={() => { onSelect(null); setError(null); }}>← All 24 games</Button>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-2xl text-ink">{GAME_LABEL[selected.kind]}</h2><p role="status" className="text-sm text-muted">{status} · You are Player {side + 1}</p></div>
        {selected.status === "FINISHED" || selected.status === "DECLINED" || selected.status === "CANCELLED" ? <Button disabled={busy} onClick={() => void act({ action: "create", kind: selected.kind, clientNonce: crypto.randomUUID() })}>Invite for a rematch</Button> : null}</div>
      <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer text-sm font-medium">How to play</summary><p className="mt-3 text-sm text-muted">{GAME_RULES[selected.kind]}</p></details>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      {selected.status === "WAITING" ? <div className="flex flex-wrap gap-2">{side === 1 ? <><Button loading={busy} onClick={() => void act({ ...version, action: "accept" })}>Accept game</Button><Button variant="secondary" disabled={busy} onClick={() => void act({ ...version, action: "decline" })}>Decline</Button></>
        : <Button variant="secondary" disabled={busy} onClick={() => void act({ ...version, action: "cancel" })}>Cancel invitation</Button>}</div> : null}
      <GameBoard key={`${selected.id}:${selected.version}`} game={selected} userId={userId} busy={busy} play={(move: GameMove) => void act({ ...version, action: "move", move })} />
      {selected.status === "ACTIVE" ? <div className="border-t border-line pt-4">{confirmResign ? <div className="flex flex-wrap items-center gap-2"><p className="text-sm text-muted">Your partner will receive the win for this match.</p><Button disabled={busy} onClick={() => void act({ ...version, action: "resign" })}>Confirm resignation</Button><Button variant="ghost" onClick={() => setConfirmResign(false)}>Keep playing</Button></div>
        : <Button variant="ghost" onClick={() => setConfirmResign(true)}>Resign this match</Button>}</div> : null}
    </div>;
  }
  const kinds = (Object.keys(GAME_LABEL) as GameKind[]).filter((kind) => GAME_LABEL[kind].toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <div><h2 className="font-display text-2xl text-ink">A little friendly competition</h2><p className="mt-1 text-sm text-muted">24 games, just for the two of you. Invite your partner to start a match. Scores save automatically when it finishes.</p></div>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {games.length ? <section className="space-y-3"><h3 className="text-sm font-medium">Your matches</h3><div className="grid gap-2 sm:grid-cols-2">{games.map((game) => <button key={game.id} type="button" onClick={() => void open(game.id)} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-left">
      <span className="text-sm font-medium">{GAME_LABEL[game.kind]}</span><span className="text-xs text-muted">{game.status === "WAITING" ? game.playerTwoId === userId ? "Invitation for you" : "Waiting" : game.status === "ACTIVE" ? "In progress" : game.status === "FINISHED" ? game.winnerId ? game.winnerId === userId ? "You won" : "Partner won" : "Draw" : "Closed"} →</span>
    </button>)}</div></section> : null}
    <SearchInput value={search} onValueChange={setSearch} placeholder="Find a mini-game" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{kinds.map((kind) => <article key={kind} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <span className="grid size-10 place-items-center rounded-xl bg-primary-tint text-primary"><Icon name="gamepad" /></span>
      <h3 className="font-display text-lg leading-tight">{GAME_LABEL[kind]}</h3><p className="line-clamp-3 flex-1 text-xs text-muted">{GAME_RULES[kind]}</p>
      <Button size="sm" variant="secondary" disabled={busy} aria-label={`Invite to ${GAME_LABEL[kind]}`} onClick={() => void act({ action: "create", kind, clientNonce: crypto.randomUUID() })}>Invite to play</Button>
    </article>)}</div>
    {!kinds.length ? <p className="text-sm text-muted">No games match that search.</p> : null}
  </div>;
}
function Scoreboard({ scores, userId, userName, partnerName }: { scores: ScoreDTO[]; userId: string; userName: string; partnerName: string }) {
  const record = (kind: GameKind, mine: boolean) => scores.find((score) => score.kind === kind && (mine ? score.userId === userId : score.userId !== userId)) ?? { wins: 0, losses: 0, draws: 0 };
  const totals = (mine: boolean) => scores.filter((score) => mine ? score.userId === userId : score.userId !== userId).reduce((sum, score) => ({ wins: sum.wins + score.wins, losses: sum.losses + score.losses, draws: sum.draws + score.draws }), { wins: 0, losses: 0, draws: 0 });
  return <div className="space-y-5"><h2 className="font-display text-2xl">Your scoreboard</h2><p className="text-sm text-muted">Completed matches count once. Cancelled or declined invitations don&apos;t count. W = wins, L = losses, D = draws.</p>
    <div className="grid grid-cols-2 gap-3">{[true, false].map((mine) => { const total = totals(mine); return <div key={String(mine)} className="rounded-xl border border-line bg-surface p-4"><p className="truncate text-sm font-medium">{mine ? userName : partnerName}</p><p className="mt-2 font-display text-3xl text-primary">{total.wins} {total.wins === 1 ? "win" : "wins"}</p><p className="text-xs text-muted">{total.losses} {total.losses === 1 ? "loss" : "losses"} · {total.draws} {total.draws === 1 ? "draw" : "draws"}</p></div>; })}</div>
    <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm"><thead className="bg-surface"><tr><th className="p-3">Game</th><th className="p-3">You<br /><span className="text-xs font-normal">W / L / D</span></th><th className="p-3">Partner<br /><span className="text-xs font-normal">W / L / D</span></th></tr></thead><tbody>{(Object.keys(GAME_LABEL) as GameKind[]).map((kind) => <tr key={kind} className="border-t border-line"><th className="p-3 font-medium">{GAME_LABEL[kind]}</th>{[true, false].map((mine) => { const row = record(kind, mine); return <td key={String(mine)} className="whitespace-nowrap p-3 tabular-nums text-muted">{row.wins} / {row.losses} / {row.draws}</td>; })}</tr>)}</tbody></table></div>
  </div>;
}
