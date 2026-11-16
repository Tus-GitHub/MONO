import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { gameChatSignalSchema } from "@/lib/validation/game-chat";
import { requireTogether, withTogetherWrite } from "./together-context";
import { callIceServers } from "./couple-call-service";

/** Signaling only. Message text is sent browser-to-browser over a DTLS data channel. */
export async function gameChatSignals(gameId: string, after: bigint) {
  const context = await requireTogether();
  const game = await prisma.gameMatch.findFirst({ where: { id: gameId, coupleId: context.couple.id } });
  if (!game || ![game.playerOneId, game.playerTwoId].includes(context.user.id)) throw new NotFoundError();
  const cutoff = new Date(Date.now() - 2 * 60_000);
  await prisma.gameChatSignal.deleteMany({ where: { gameId, ...(game.status === "ACTIVE" ? { createdAt: { lt: cutoff } } : {}) } });
  const signals = game.status === "ACTIVE" ? await prisma.gameChatSignal.findMany({ where: { gameId, senderId: context.partner.id, id: { gt: after }, createdAt: { gte: cutoff } }, orderBy: { id: "asc" }, take: 100 }) : [];
  return { active: game.status === "ACTIVE", iceServers: callIceServers(), signals: signals.map(row => ({ id: String(row.id), sessionId: row.sessionId, targetSessionId: row.targetSessionId, kind: row.kind, payload: row.payload })) };
}
export async function sendGameChatSignal(value: unknown) {
  const input = gameChatSignalSchema.parse(value), context = await requireTogether();
  await withTogetherWrite(context, async tx => {
    const game = await tx.gameMatch.findFirst({ where: { id: input.gameId, coupleId: context.couple.id } });
    if (!game || ![game.playerOneId, game.playerTwoId].includes(context.user.id)) throw new NotFoundError();
    if (game.status !== "ACTIVE") throw new ValidationError("Match chat closes when the game ends.");
    if ((input.signal.kind === "offer" && context.user.id !== game.playerOneId) || (input.signal.kind === "answer" && context.user.id !== game.playerTwoId)) throw new ValidationError("Invalid game chat negotiation.");
    const recent = new Date(Date.now() - 60_000);
    if (await tx.gameChatSignal.count({ where: { gameId: game.id, senderId: context.user.id, createdAt: { gt: recent } } }) >= 120) throw new ValidationError("Wait a moment before reconnecting match chat.");
    await tx.gameChatSignal.create({ data: { gameId: game.id, senderId: context.user.id, sessionId: input.sessionId, targetSessionId: input.targetSessionId,
      kind: input.signal.kind, payload: input.signal.payload as Prisma.InputJsonValue } });
  });
  return { ok: true };
}
