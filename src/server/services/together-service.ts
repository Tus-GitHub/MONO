import "server-only";
import { randomInt } from "node:crypto";
import { readSavedCrop } from "@/lib/images/saved-crop";
import { Prisma, type ChatMessage, type GameMatch } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { gameActionSchema, presenceSchema } from "@/lib/validation/together";
import { newGame, parseGame, playGame, GAME_LABEL } from "@/lib/together/games";
import { publicArcade } from "@/lib/together/arcade";
import { secureMessageSchema } from "@/lib/validation/chat-security";
import { assertChatKey } from "./chat-security-service";
import type { GameDTO, MessageDTO, ScoreDTO, TogetherSnapshot } from "@/lib/together/types";
import { bumpTogether, requireTogether, withTogetherWrite } from "./together-context";
import { RECENT_GAME_WINDOW_MS } from "@/lib/together/game-list";
import { SOLO_KINDS, type SoloScore } from "@/lib/solo-games/catalog";

export const imageSelect = { width: true, height: true, contentType: true, encrypted: true, viewLimit: true, viewsUsed: true, crop: true } satisfies Prisma.ChatImageSelect;
export function messageDTO(row: ChatMessage & { image: { width: number; height: number; contentType: string; encrypted: boolean; viewLimit: number; viewsUsed: number; crop?: unknown } | null }, userId: string): MessageDTO {
  const hidden = row.hiddenFor.includes(userId), deleted = Boolean(row.deletedAt);
  return { id: row.id, generation: row.generation, sequence: String(row.sequence), senderId: row.senderId, kind: row.kind,
    body: hidden || deleted ? "" : row.body, gameId: hidden || deleted ? null : row.gameId,
    clientNonce: row.clientNonce, encrypted: row.encrypted, version: row.version, editedAt: row.editedAt?.toISOString() ?? null, hidden, deleted,
    createdAt: row.createdAt.toISOString(), image: !hidden && !deleted && row.image ? { ...row.image, crop: readSavedCrop(row.image.crop), url: `/api/together/images/${row.id}` } : null };
}
export function gameDTO(row: GameMatch, userId: string): GameDTO {
  const state = parseGame(row.kind, row.state);
  return { id: row.id, kind: row.kind, status: row.status, playerOneId: row.playerOneId, playerTwoId: row.playerTwoId,
    rematchRequestedById: row.rematchRequestedById, rematchRequestedAt: row.rematchRequestedAt?.toISOString() ?? null, rematchGameId: row.rematchGameId,
    winnerId: row.winnerId, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    state: state.type === "ARCADE" ? publicArcade(state, userId === row.playerOneId ? 0 : 1) : state };
}
export async function getGame(id: string): Promise<GameDTO> {
  const context = await requireTogether();
  const row = await prisma.gameMatch.findFirst({ where: { id, coupleId: context.couple.id } });
  if (!row) throw new NotFoundError();
  return gameDTO(row, context.user.id);
}
export async function togetherSnapshot(options: { after?: bigint; before?: bigint; revision?: string } = {}): Promise<TogetherSnapshot> {
  const context = await requireTogether(), { couple, user, partner } = context;
  const changed = options.revision !== String(couple.togetherRevision) || options.after == null;
  const [messages, peer, games, grouped, imageUsage, updates, soloScores] = await Promise.all([
    changed || options.after != null || options.before != null ? prisma.chatMessage.findMany({ where: { coupleId: couple.id, generation: couple.chatGeneration,
      ...(options.before != null ? { sequence: { lt: options.before } } : options.after != null ? { sequence: { gt: options.after } } : {}) },
      orderBy: { sequence: options.after != null && options.before == null ? "asc" : "desc" }, take: 60, include: { image: { select: imageSelect } } }) : Promise.resolve([]),
    prisma.chatMemberState.findUnique({ where: { coupleId_userId: { coupleId: couple.id, userId: partner.id } } }),
    changed && options.before == null ? Promise.all([
      prisma.gameMatch.findMany({ where: { coupleId: couple.id, status: { in: ["WAITING", "ACTIVE"] } }, orderBy: { updatedAt: "desc" }, take: 5 }),
      prisma.gameMatch.findMany({ where: { coupleId: couple.id, status: { notIn: ["WAITING", "ACTIVE"] }, updatedAt: { gte: new Date(Date.now() - RECENT_GAME_WINDOW_MS) } }, orderBy: { updatedAt: "desc" }, take: 50 }),
    ]).then((rows) => rows.flat()) : Promise.resolve(undefined),
    changed && options.before == null ? prisma.gameMatch.groupBy({ by: ["kind", "winnerId"], where: { coupleId: couple.id, status: "FINISHED" }, _count: { _all: true } }) : Promise.resolve(undefined),
    changed && options.before == null ? prisma.chatImage.aggregate({ where: { coupleId: couple.id }, _sum: { byteLength: true } }) : Promise.resolve(undefined),
    options.revision != null && options.before == null ? prisma.chatMessage.findMany({ where: { coupleId: couple.id, generation: couple.chatGeneration, revision: { gt: BigInt(options.revision), lte: couple.togetherRevision } }, orderBy: [{ revision: "asc" }, { sequence: "asc" }], take: 60, include: { image: { select: imageSelect } } }) : Promise.resolve([]),
    changed && options.before == null ? prisma.soloGameScore.findMany({ where: { coupleId: couple.id, userId: { in: [user.id, partner.id] }, kind: { in: SOLO_KINDS } }, select: { kind: true, userId: true, bestScore: true } }) : Promise.resolve(undefined),
  ]);
  if (!(options.after != null && options.before == null)) messages.reverse();
  const scores: ScoreDTO[] = [];
  if (grouped) for (const kind of Object.keys(GAME_LABEL) as (keyof typeof GAME_LABEL)[]) for (const id of [user.id, partner.id]) {
    const results = grouped.filter((row) => row.kind === kind);
    if (results.length) scores.push({ kind, userId: id,
      wins: 0,
      losses: 0, draws: 0 });
  }
  // Aggregate only counts, never load the full historical match list to build scores.
  for (const score of scores) for (const row of grouped ?? []) if (row.kind === score.kind) {
    if (!row.winnerId) score.draws += row._count._all;
    else if (row.winnerId === score.userId) score.wins += row._count._all;
    else score.losses += row._count._all;
  }
  return { coupleId: couple.id, chatKeyId: couple.chatKeyId, chatGeneration: couple.chatGeneration, revision: String(updates.length === 60 ? updates[59].revision : couple.togetherRevision), updates: updates.map((row) => messageDTO(row, user.id)), cursor: messages.length ? String(messages[messages.length - 1].sequence) : String(options.after ?? 0),
    messages: messages.map((row) => messageDTO(row, user.id)), games: games?.map((row) => gameDTO(row, user.id)), scores: grouped ? scores : undefined, soloScores: soloScores as SoloScore[] | undefined,
    imageBytes: imageUsage?._sum.byteLength ?? (imageUsage ? 0 : undefined), hasMore: messages.length === 60,
    timezone: couple.timezone, observedAt: new Date().toISOString(), partner: { ...partner, lastRead: String(peer?.lastRead ?? 0), lastSeenAt: peer?.lastSeenAt.toISOString() ?? null, typingUntil: peer?.typingUntil?.toISOString() ?? null } };
}
export async function checkMessageRate(tx: Prisma.TransactionClient, userId: string) {
  if (await tx.chatMessage.count({ where: { senderId: userId, createdAt: { gt: new Date(Date.now() - 60_000) } } }) >= 90) throw new ValidationError("Give your partner a moment before sending more messages.");
}
export async function sendChatMessage(value: unknown): Promise<MessageDTO> {
  const input = secureMessageSchema.parse(value), context = await requireTogether();
  const row = await withTogetherWrite(context, async (tx) => {
    await assertChatKey(tx, context, JSON.parse(input.body).keyId);
    const existing = await tx.chatMessage.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce: input.clientNonce } }, include: { image: { select: imageSelect } } });
    if (existing) { if (existing.coupleId !== context.couple.id || existing.generation !== context.couple.chatGeneration) throw new ConflictError("Start a fresh message."); return existing; }
    await checkMessageRate(tx, context.user.id);
    const message = await tx.chatMessage.create({ data: { ...input, generation: context.couple.chatGeneration, encrypted: true, senderId: context.user.id, coupleId: context.couple.id }, include: { image: { select: imageSelect } } });
    await bumpTogether(tx, context.couple.id); return message;
  });
  return messageDTO(row, context.user.id);
}
export async function updateChatPresence(value: unknown) {
  const input = presenceSchema.parse(value), context = await requireTogether();
  await withTogetherWrite(context, async (tx) => {
    const last = await tx.chatMessage.findFirst({ where: { coupleId: context.couple.id, generation: context.couple.chatGeneration }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    const read = input.sequence > (last?.sequence ?? BigInt(0)) ? last?.sequence ?? BigInt(0) : input.sequence;
    const where = { coupleId_userId: { coupleId: context.couple.id, userId: context.user.id } };
    const old = await tx.chatMemberState.findUnique({ where });
    await tx.chatMemberState.upsert({ where, create: { coupleId: context.couple.id, userId: context.user.id, lastRead: read, typingUntil: input.typing ? new Date(Date.now() + 6000) : null },
      update: { lastRead: read > (old?.lastRead ?? BigInt(0)) ? read : old?.lastRead ?? BigInt(0), lastSeenAt: new Date(), typingUntil: input.typing ? new Date(Date.now() + 6000) : null } });
  });
}
const json = (state: unknown) => JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
export async function actOnGame(value: unknown): Promise<GameDTO> {
  const input = gameActionSchema.parse(value), context = await requireTogether();
  const result = await withTogetherWrite(context, async (tx) => {
    if (input.action === "create") {
      const existing = await tx.gameMatch.findUnique({ where: { playerOneId_clientNonce: { playerOneId: context.user.id, clientNonce: input.clientNonce } } });
      if (existing) { if (existing.coupleId !== context.couple.id) throw new ConflictError("Start a fresh invitation."); return existing; }
      if (await tx.gameMatch.count({ where: { coupleId: context.couple.id, status: { in: ["WAITING", "ACTIVE"] } } }) >= 5) throw new ValidationError("Finish or cancel a game before starting another (up to five at once).");
      const match = await tx.gameMatch.create({ data: { coupleId: context.couple.id, playerOneId: context.user.id, playerTwoId: context.partner.id,
        clientNonce: input.clientNonce, kind: input.kind, state: json(newGame(input.kind, (max) => randomInt(max))) } });
      await tx.chatMessage.create({ data: { coupleId: context.couple.id, generation: context.couple.chatGeneration, senderId: context.user.id, clientNonce: `game-invite:${match.id}`, kind: "GAME", encrypted: true, gameId: match.id, body: "" } });
      await bumpTogether(tx, context.couple.id); return match;
    }
    const match = await tx.gameMatch.findFirst({ where: { id: input.id, coupleId: context.couple.id } });
    if (!match) throw new NotFoundError();
    if (input.action.startsWith("rematch-")) {
      if (match.status !== "FINISHED" || ![match.playerOneId, match.playerTwoId].includes(context.user.id)) throw new ValidationError("Finish this match before requesting a rematch.");
      if (match.rematchGameId) return match;
      const pending = !!match.rematchRequestedById && !!match.rematchRequestedAt && Date.now() - match.rematchRequestedAt.getTime() < 5 * 60_000;
      if (input.action === "rematch-request" && pending) return match;
      if (match.version !== input.version) throw new ConflictError("The rematch changed. Please try again.");
      let data: Prisma.GameMatchUpdateInput = { version: { increment: 1 } };
      if (input.action === "rematch-request") {
        data = { ...data, rematchRequestedById: context.user.id, rematchRequestedAt: new Date() };
      } else {
        const own = match.rematchRequestedById === context.user.id;
        if (!pending || (input.action === "rematch-cancel" ? !own : own)) throw new ValidationError("That rematch request is no longer available.");
        data = { ...data, rematchRequestedById: null, rematchRequestedAt: null };
        if (input.action === "rematch-accept") {
          if (await tx.gameMatch.count({ where: { coupleId: context.couple.id, status: { in: ["WAITING", "ACTIVE"] } } }) >= 5) throw new ValidationError("Finish or cancel another game before the rematch.");
          const next = await tx.gameMatch.create({ data: { coupleId: context.couple.id, playerOneId: match.playerTwoId, playerTwoId: match.playerOneId,
            clientNonce: `rematch:${match.id}`, kind: match.kind, status: "ACTIVE", state: json(newGame(match.kind, (max) => randomInt(max))) } });
          data.rematchGame = { connect: { id: next.id } };
        }
      }
      const updated = await tx.gameMatch.update({ where: { id: match.id }, data });
      await bumpTogether(tx, context.couple.id); return updated;
    }
    if (match.version !== input.version) throw new ConflictError("The game has moved on. The latest board will appear now.");
    const side = context.user.id === match.playerOneId ? 0 : context.user.id === match.playerTwoId ? 1 : null;
    if (side == null) throw new NotFoundError();
    let data: Prisma.GameMatchUpdateInput = { version: { increment: 1 } };
    if (input.action === "accept" || input.action === "decline" || input.action === "cancel") {
      if (match.status !== "WAITING" || (input.action === "cancel" ? side !== 0 : side !== 1)) throw new ValidationError("That invitation is no longer available for this action.");
      data.status = input.action === "accept" ? "ACTIVE" : input.action === "decline" ? "DECLINED" : "CANCELLED";
    } else {
      if (match.status !== "ACTIVE") throw new ValidationError("Accept the invitation before playing. Finished games cannot be changed.");
      let outcome: 0 | 1 | "draw" | undefined;
      if (input.action === "resign") outcome = side === 0 ? 1 : 0;
      else if (input.action === "move") {
        try { const result = playGame(parseGame(match.kind, match.state), side, input.move, input.move.type === "roll" ? randomInt(1, 7) : undefined); data.state = json(result.state); outcome = result.outcome; }
        catch (error) { throw new ValidationError(error instanceof Error ? error.message : "Choose a legal move."); }
      }
      if (outcome !== undefined) {
        await tx.gameChatSignal.deleteMany({ where: { gameId: match.id } });
        data = { ...data, status: "FINISHED", finishedAt: new Date(), ...(outcome !== "draw" ? { winner: { connect: { id: outcome === 0 ? match.playerOneId : match.playerTwoId } } } : {}) };
        await tx.chatMessage.create({ data: { coupleId: context.couple.id, generation: context.couple.chatGeneration, senderId: context.user.id, clientNonce: `game-result:${match.id}`, kind: "GAME", encrypted: true, gameId: match.id,
          body: "" } });
      }
    }
    const updated = await tx.gameMatch.update({ where: { id: match.id }, data });
    await bumpTogether(tx, context.couple.id); return updated;
  });
  return gameDTO(result, context.user.id);
}
