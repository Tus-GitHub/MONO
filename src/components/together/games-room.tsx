"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { PageContainer } from "@/components/layout/page-container";
import { useTogether } from "@/lib/hooks/use-together";
import type { ChatKey } from "@/lib/together/chat-crypto";
import type { GameDTO, GameHistoryPage, TogetherSnapshot } from "@/lib/together/types";
import { mergeGameHistory } from "@/lib/together/game-list";
import { togetherFetch, errorMessage } from "@/lib/together/client";
import { cn } from "@/lib/utils/cn";
import GamesPanel from "./games-panel";
import { GameMatchList } from "./game-match-list";

const ChatConversation = dynamic(() => import("./together-room").then((module) => module.ChatConversation), {
  loading: () => <div className="grid flex-1 place-items-center"><Spinner /></div>,
});

export function GamesRoom({ initial, userId, userName, mode = "games", initialGame, history }: {
  initial: TogetherSnapshot; userId: string; userName: string; mode?: "games" | "history" | "scores";
  initialGame?: GameDTO; history?: GameHistoryPage;
}) {
  const router = useRouter(), [chatOpen, setChatOpen] = useState(false), [chatKey, setChatKey] = useState<ChatKey | null>(null);
  const nextGame = useRef<string | null>(null);
  const chat = useTogether(initial, chatOpen && chatKey != null);
  const selectedId = initialGame?.id ?? null;
  return <PageContainer className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-3xl text-ink">Games</h1>
      <nav aria-label="Games" className="flex flex-wrap gap-1">{([['games', '/games', 'Play'], ['history', '/games/history', 'History'], ['scores', '/games/scores', 'Scores']] as const).map(([key, href, label]) => <Link key={key} href={href} aria-current={mode === key ? "page" : undefined} className={cn("tap flex items-center rounded-lg px-3 text-sm font-medium", mode === key ? "bg-primary-tint text-primary" : "text-muted hover:bg-surface")}>{label}</Link>)}</nav>
    </div>
    {chat.error && !chatOpen ? <p role="alert" className="text-sm text-error">Game updates paused: {chat.error} <Button variant="link" onClick={() => void chat.refresh()}>Reconnect</Button></p> : null}
    {mode === "history" ? <GameHistory initial={history ?? { games: [], nextCursor: null }} live={chat.data.games ?? []} userId={userId} timezone={chat.data.timezone} /> : <GamesPanel key={selectedId ?? mode}
      games={chat.data.games ?? []} scores={chat.data.scores ?? []} userId={userId} userName={userName} partnerName={chat.data.partner.name}
      selectedId={selectedId} initialGame={initialGame} onSelect={(id) => router.push(id ? `/games/${id}` : "/games")}
      refresh={chat.refresh} mode={mode} observedAt={chat.data.observedAt} timezone={chat.data.timezone} onChat={() => setChatOpen(true)} />}
    <Modal open={chatOpen} onClose={() => setChatOpen(false)} size="full" className="mono-game-chat-panel" title="Match chat" description="Your game stays open and updates while you chat." closeLabel="Return to game"
      onHistoryClosed={(stayed) => { const id = nextGame.current; nextGame.current = null; if (stayed && id && id !== selectedId) router.push(`/games/${id}`); }}>
      <ChatConversation chat={chat} chatKey={chatKey} onUnlock={setChatKey} userId={userId} openGame={(id) => { nextGame.current = id; setChatOpen(false); }} />
    </Modal>
  </PageContainer>;
}

function GameHistory({ initial, live, userId, timezone }: { initial: GameHistoryPage; live: GameDTO[]; userId: string; timezone: string }) {
  const [page, setPage] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = useRef(false);
  const loaded = new Set(page.games.map((game) => game.id));
  const latestStart = page.games[0]?.createdAt;
  const rows = mergeGameHistory(page.games, live.filter((game) => loaded.has(game.id) || !latestStart || game.createdAt >= latestStart));
  const more = async () => {
    if (pending.current || !page.nextCursor) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const next = await togetherFetch<GameHistoryPage>(`/api/together/games/history?before=${encodeURIComponent(page.nextCursor)}`);
      setPage((previous) => ({ games: mergeGameHistory(previous.games, next.games), nextCursor: next.nextCursor }));
    } catch (error) { setError(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="space-y-4" aria-label="Game history"><div><h2 className="font-display text-2xl">Your game history</h2><p className="mt-1 text-sm text-muted">All your matches, newest first. Open an older match to review it, resume play or close an invitation.</p></div>
    {rows.length ? <GameMatchList games={rows} userId={userId} timezone={timezone} /> : <p className="text-sm text-muted">Your matches will appear here when you start playing.</p>}
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {page.nextCursor ? <Button variant="secondary" loading={busy} onClick={() => void more()}>Load earlier matches</Button> : null}
  </section>;
}
