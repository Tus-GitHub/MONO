"use client";
import Link from "@/components/ui/app-link";
import { GAME_LABEL } from "@/lib/together/games";
import type { GameDTO } from "@/lib/together/types";

export function GameMatchList({ games, userId, timezone }: { games: GameDTO[]; userId: string; timezone: string }) {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return <div className="grid gap-2 sm:grid-cols-2">{games.map((game) => <Link key={game.id} href={`/games/${game.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-left">
    <span className="min-w-0"><span className="block text-sm font-medium">{GAME_LABEL[game.kind]}</span><span className="text-2xs text-faint">Last activity · {time.format(new Date(game.updatedAt))}</span></span>
    <span className="text-xs text-muted">{game.status === "WAITING" ? game.playerTwoId === userId ? "Invitation for you" : "Waiting" : game.status === "ACTIVE" ? "In progress" : game.status === "FINISHED" ? game.winnerId ? game.winnerId === userId ? "You won" : "Partner won" : "Draw" : game.status === "CANCELLED" ? "Cancelled" : "Declined"} →</span>
  </Link>)}</div>;
}
