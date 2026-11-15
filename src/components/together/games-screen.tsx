import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/errors";
import { idSchema } from "@/lib/validation/common";
import { togetherSnapshot, getGame } from "@/server/services/together-service";
import { getGameHistory } from "@/server/services/game-history-service";
import { GamesRoom } from "./games-room";

export async function GamesScreen({ mode = "games", gameId }: { mode?: "games" | "history" | "scores"; gameId?: string }) {
  if (gameId && !idSchema.safeParse(gameId).success) notFound();
  const [user, initial, game, history] = await Promise.all([
    requireUser(), togetherSnapshot(), gameId ? getGame(gameId) : undefined,
    mode === "history" ? getGameHistory() : undefined,
  ]).catch((error: unknown) => { if (error instanceof NotFoundError) notFound(); throw error; });
  return <GamesRoom key={gameId ?? mode} initial={initial} userId={user.id} userName={user.name} mode={mode} initialGame={game} history={history} />;
}
