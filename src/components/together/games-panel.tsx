"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search";
import { Icon } from "@/components/ui/icon";
import { GAME_LABEL, type GameKind, type GameMove } from "@/lib/together/games";
import { GAME_RULES } from "@/lib/together/arcade-view";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import type { GameDTO, ScoreDTO } from "@/lib/together/types";
import { recentGames } from "@/lib/together/game-list";
import Link from "@/components/ui/app-link";
import { GameMatchList } from "./game-match-list";
import GameBoard from "./game-board";
import { GameChat } from "./game-chat";
import { GameOutcome, rematchPending } from "./game-rematch";
import { SOLO_GAMES, SOLO_KINDS, type SoloScore } from "@/lib/solo-games/catalog";
import { SoloHighScores } from "@/components/solo-games/high-scores";
import { LinkButton } from "@/components/ui/link-button";

const gameCount = Object.keys(GAME_LABEL).length + SOLO_KINDS.length;

export default function GamesPanel({ games, scores, soloScores = [], userId, userName, partnerName, selectedId, onSelect, refresh, mode, observedAt, timezone, initialGame = null }: {
  games: GameDTO[]; scores: ScoreDTO[]; userId: string; userName: string; partnerName: string;
  selectedId: string | null; onSelect: (id: string | null) => void; refresh: () => Promise<void>; mode: "games" | "scores";
  observedAt: string; timezone: string; initialGame?: GameDTO | null; soloScores?: SoloScore[];
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [search, setSearch] = useState("");
  const [detail, setDetail] = useState<GameDTO | null>(initialGame), [confirmResign, setConfirmResign] = useState(false);
  const awaitingRematch = useRef<string | null>(null);
  const latest = games.find((game) => game.id === selectedId), local = detail?.id === selectedId ? detail : null;
  const selected = local && (!latest || local.version > latest.version) ? local : latest ?? null;
  useEffect(() => {
    if (!selectedId || selected) return;
    let live = true;
    void togetherFetch<GameDTO>(`/api/together/games?id=${selectedId}`).then((game) => { if (live) setDetail(game); }).catch((error) => { if (live) setError(errorMessage(error)); });
    return () => { live = false; };
  }, [selectedId, selected]);
  useEffect(() => {
    if (selected?.rematchRequestedById === userId && rematchPending(selected)) awaitingRematch.current = selected.id;
    if (selected?.rematchGameId && awaitingRematch.current === selected.id) {
      awaitingRematch.current = null; onSelect(selected.rematchGameId);
    }
  }, [selected, userId, onSelect]);
  const act = async (body: unknown) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const game = await togetherFetch<GameDTO>("/api/together/games", { body }); setDetail(game); if (game.id !== selectedId) onSelect(game.id); await refresh(); }
    catch (error) { setError(errorMessage(error)); await refresh().catch(() => {}); }
    finally { setBusy(false); setConfirmResign(false); }
  };
  if (mode === "scores") return <div className="space-y-8"><SoloHighScores scores={soloScores} userId={userId} userName={userName} partnerName={partnerName} /><Scoreboard scores={scores} userId={userId} userName={userName} partnerName={partnerName} /></div>;
  if (selected) {
    const side = selected.playerOneId === userId ? 0 : 1, currentName = selected.state.turn === side ? "Your turn" : `${partnerName}'s turn`;
    const status = selected.status === "WAITING" ? side === 0 ? `Waiting for ${partnerName}` : `${partnerName} invited you` : selected.status === "FINISHED"
      ? selected.winnerId ? selected.winnerId === userId ? "You won this match" : `${partnerName} won this match` : "This match was a draw"
      : selected.status === "ACTIVE" ? selected.kind === "ROCK_PAPER_SCISSORS" ? "Both choose privately" : currentName : selected.status === "CANCELLED" ? "Invitation cancelled" : "Invitation declined";
    const version = { id: selected.id, version: selected.version };
    return <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" onClick={() => { onSelect(null); setError(null); }}>← All {gameCount} games</Button></div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-2xl text-ink">{GAME_LABEL[selected.kind]}</h2><p role="status" className="text-sm text-muted">{status} · You are Player {side + 1}</p></div>
        {selected.status === "FINISHED" ? <GameOutcome key={selected.id} game={selected} userId={userId} partnerName={partnerName} userName={userName} busy={busy} onRequest={() => { awaitingRematch.current = selected.id; void act({ ...version, action: "rematch-request" }); }} onCancel={() => { awaitingRematch.current = null; void act({ ...version, action: "rematch-cancel" }); }} onOpen={() => onSelect(selected.rematchGameId!)} /> : selected.status === "DECLINED" || selected.status === "CANCELLED" ? <Button disabled={busy} onClick={() => void act({ action: "create", kind: selected.kind, clientNonce: crypto.randomUUID() })}>Invite again</Button> : null}</div>
      <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer text-sm font-medium">How to play</summary><p className="mt-3 text-sm text-muted">{GAME_RULES[selected.kind]}</p></details>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      {selected.status === "WAITING" ? <div className="flex flex-wrap gap-2">{side === 1 ? <><Button loading={busy} onClick={() => void act({ ...version, action: "accept" })}>Accept game</Button><Button variant="secondary" disabled={busy} onClick={() => void act({ ...version, action: "decline" })}>Decline</Button></>
        : <Button variant="secondary" disabled={busy} onClick={() => void act({ ...version, action: "cancel" })}>Cancel invitation</Button>}</div> : null}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0"><GameBoard key={`${selected.id}:${selected.version}`} game={selected} userId={userId} busy={busy} play={(move: GameMove) => void act({ ...version, action: "move", move })} /></div>
        {selected.status === "ACTIVE" ? <aside className="min-w-0 space-y-3" aria-label="Match controls and chat">
          <div>{confirmResign ? <div className="flex flex-wrap items-center gap-2"><p className="w-full text-sm text-muted">Your partner will receive the win for this match.</p><Button disabled={busy} onClick={() => void act({ ...version, action: "resign" })}>Confirm resignation</Button><Button variant="ghost" onClick={() => setConfirmResign(false)}>Keep playing</Button></div>
            : <Button variant="ghost" onClick={() => setConfirmResign(true)}>Resign this match</Button>}</div>
          <GameChat key={selected.id} gameId={selected.id} initiator={selected.playerOneId === userId} partnerName={partnerName} />
        </aside> : null}
      </div>
    </div>;
  }
  const kinds = (Object.keys(GAME_LABEL) as GameKind[]).filter((kind) => GAME_LABEL[kind].toLowerCase().includes(search.toLowerCase()));
  const soloKinds = SOLO_KINDS.filter(kind => `${SOLO_GAMES[kind].name} solo`.toLowerCase().includes(search.toLowerCase()));
  const recent = recentGames(games, observedAt);
  const olderOpen = games.filter((game) => (game.status === "WAITING" || game.status === "ACTIVE") && !recent.some((row) => row.id === game.id)).length;
  return <div className="space-y-6">
    <div><h2 className="font-display text-2xl text-ink">A little friendly competition</h2><p className="mt-1 text-sm text-muted">{gameCount} games, just for the two of you. Beat your personal best in a solo game, or invite your partner to a match. Scores save automatically.</p></div>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    <section aria-label="Your matches" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium">Your matches</h3><p className="text-xs text-muted">Active in the last 60 minutes</p></div><Link href="/games/history" className="text-sm text-primary underline">Full history</Link></div>
      {recent.length ? <GameMatchList games={recent} userId={userId} timezone={timezone} /> : <p className="text-sm text-muted">No matches in the last hour. Pick a game below to play together.</p>}
      {olderOpen ? <p className="text-xs text-muted">{olderOpen} older {olderOpen === 1 ? "match is" : "matches are"} still open. <Link href="/games/history" className="text-primary underline">Open History to resume or close them.</Link></p> : null}
    </section>
    <SearchInput value={search} onValueChange={setSearch} placeholder="Find a mini-game" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{soloKinds.map(kind => <article key={kind} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-primary-tint text-xl">{SOLO_GAMES[kind].emoji}</span>
      <h3 className="font-display text-lg leading-tight">{SOLO_GAMES[kind].name}</h3><p className="line-clamp-3 flex-1 text-xs text-muted">{SOLO_GAMES[kind].description}</p>
      <p className="text-xs text-muted">Solo · Best: <span className="font-medium text-ink">{soloScores.find(s => s.kind === kind && s.userId === userId)?.bestScore.toLocaleString() ?? "—"}</span></p>
      <LinkButton size="sm" variant="secondary" href={`/games/solo/${SOLO_GAMES[kind].slug}`} aria-label={`Play ${SOLO_GAMES[kind].name}`}>Play solo</LinkButton>
    </article>)}{kinds.map((kind) => <article key={kind} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <span className="grid size-10 place-items-center rounded-xl bg-primary-tint text-primary"><Icon name="gamepad" /></span>
      <h3 className="font-display text-lg leading-tight">{GAME_LABEL[kind]}</h3><p className="line-clamp-3 flex-1 text-xs text-muted">{GAME_RULES[kind]}</p>
      <Button size="sm" variant="secondary" disabled={busy} aria-label={`Invite to ${GAME_LABEL[kind]}`} onClick={() => void act({ action: "create", kind, clientNonce: crypto.randomUUID() })}>Invite to play</Button>
    </article>)}</div>
    {!kinds.length && !soloKinds.length ? <p className="text-sm text-muted">No games match that search.</p> : null}
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
