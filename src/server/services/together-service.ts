import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type ChatMessage, type GameMatch } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { messageSchema, gameActionSchema, presenceSchema } from "@/lib/validation/together";
import { newGame, parseGame, playGame, GAME_LABEL } from "@/lib/together/games";
import { publicArcade } from "@/lib/together/arcade";
import { CHAT_IMAGE_LIMIT, CHAT_IMAGE_SPACE } from "@/lib/together/catalog";
import type { ProcessedImage } from "@/lib/images";
import type { GameDTO, MessageDTO, ScoreDTO, TogetherSnapshot } from "@/lib/together/types";
import { bumpTogether, requireTogether, withTogetherWrite, type TogetherContext } from "./together-context";

const imageSelect = { width: true, height: true } satisfies Prisma.ChatImageSelect;
function messageDTO(row: ChatMessage & { image: { width: number; height: number } | null }): MessageDTO {
  return { id: row.id, sequence: String(row.sequence), senderId: row.senderId, kind: row.kind, body: row.body, gameId: row.gameId,
    createdAt: row.createdAt.toISOString(), image: row.image ? { ...row.image, url: `/api/together/images/${row.id}` } : null };
}
export function gameDTO(row: GameMatch, userId: string): GameDTO {
  const state = parseGame(row.kind, row.state);
  return { id: row.id, kind: row.kind, status: row.status, playerOneId: row.playerOneId, playerTwoId: row.playerTwoId,
    winnerId: row.winnerId, version: row.version, createdAt: row.createdAt.toISOString(),
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
  const [messages, peer, games, grouped, imageUsage] = await Promise.all([
    changed || options.after != null || options.before != null ? prisma.chatMessage.findMany({ where: { coupleId: couple.id,
      ...(options.before != null ? { sequence: { lt: options.before } } : options.after != null ? { sequence: { gt: options.after } } : {}) },
      orderBy: { sequence: options.after != null && options.before == null ? "asc" : "desc" }, take: 60, include: { image: { select: imageSelect } } }) : Promise.resolve([]),
    prisma.chatMemberState.findUnique({ where: { coupleId_userId: { coupleId: couple.id, userId: partner.id } } }),
    changed && options.before == null ? Promise.all([
      prisma.gameMatch.findMany({ where: { coupleId: couple.id, status: { in: ["WAITING", "ACTIVE"] } }, orderBy: { updatedAt: "desc" }, take: 5 }),
      prisma.gameMatch.findMany({ where: { coupleId: couple.id, status: { notIn: ["WAITING", "ACTIVE"] } }, orderBy: { updatedAt: "desc" }, take: 15 }),
    ]).then((rows) => rows.flat()) : Promise.resolve(undefined),
    changed && options.before == null ? prisma.gameMatch.groupBy({ by: ["kind", "winnerId"], where: { coupleId: couple.id, status: "FINISHED" }, _count: { _all: true } }) : Promise.resolve(undefined),
    changed && options.before == null ? prisma.chatImage.aggregate({ where: { coupleId: couple.id }, _sum: { byteLength: true } }) : Promise.resolve(undefined),
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
  return { revision: String(couple.togetherRevision), cursor: messages.length ? String(messages[messages.length - 1].sequence) : String(options.after ?? 0),
    messages: messages.map(messageDTO), games: games?.map((row) => gameDTO(row, user.id)), scores: grouped ? scores : undefined,
    imageBytes: imageUsage?._sum.byteLength ?? (imageUsage ? 0 : undefined), hasMore: messages.length === 60,
    timezone: couple.timezone, observedAt: new Date().toISOString(), partner: { ...partner, lastRead: String(peer?.lastRead ?? 0), lastSeenAt: peer?.lastSeenAt.toISOString() ?? null, typingUntil: peer?.typingUntil?.toISOString() ?? null } };
}
async function checkMessageRate(tx: Prisma.TransactionClient, userId: string) {
  if (await tx.chatMessage.count({ where: { senderId: userId, createdAt: { gt: new Date(Date.now() - 60_000) } } }) >= 90) throw new ValidationError("Give your partner a moment before sending more messages.");
}
export async function sendChatMessage(value: unknown): Promise<MessageDTO> {
  const input = messageSchema.parse(value), context = await requireTogether();
  const row = await withTogetherWrite(context, async (tx) => {
    const existing = await tx.chatMessage.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce: input.clientNonce } }, include: { image: { select: imageSelect } } });
    if (existing) { if (existing.coupleId !== context.couple.id) throw new ConflictError("Start a fresh message."); return existing; }
    await checkMessageRate(tx, context.user.id);
    const message = await tx.chatMessage.create({ data: { ...input, senderId: context.user.id, coupleId: context.couple.id }, include: { image: { select: imageSelect } } });
    await bumpTogether(tx, context.couple.id); return message;
  });
  return messageDTO(row);
}
export async function sendChatImage(context: TogetherContext, clientNonce: string, processed: ProcessedImage): Promise<MessageDTO> {
  const image = processed.display.bytes <= CHAT_IMAGE_LIMIT ? processed.display : processed.thumb;
  if (image.bytes > CHAT_IMAGE_LIMIT || image.bytes !== image.buffer.byteLength) throw new ValidationError("Choose a smaller image (up to 512 KB after compression).");
  const row = await withTogetherWrite(context, async (tx) => {
    const existing = await tx.chatMessage.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce } }, include: { image: { select: imageSelect } } });
    if (existing) { if (existing.coupleId !== context.couple.id) throw new ConflictError("Start a fresh image message."); return existing; }
    await checkMessageRate(tx, context.user.id);
    const used = await tx.chatImage.aggregate({ where: { coupleId: context.couple.id }, _sum: { byteLength: true } });
    if ((used._sum.byteLength ?? 0) + image.bytes > CHAT_IMAGE_SPACE) throw new ValidationError("Your shared chat image storage is full (25 MB).");
    const message = await tx.chatMessage.create({ data: { senderId: context.user.id, coupleId: context.couple.id, clientNonce, kind: "IMAGE",
      image: { create: { coupleId: context.couple.id, bytes: new Uint8Array(image.buffer), byteLength: image.bytes, contentType: image.contentType, width: image.width, height: image.height } } }, include: { image: { select: imageSelect } } });
    await bumpTogether(tx, context.couple.id); return message;
  });
  return messageDTO(row);
}
export async function updateChatPresence(value: unknown) {
  const input = presenceSchema.parse(value), context = await requireTogether();
  await withTogetherWrite(context, async (tx) => {
    const last = await tx.chatMessage.findFirst({ where: { coupleId: context.couple.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
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
      await tx.chatMessage.create({ data: { coupleId: context.couple.id, senderId: context.user.id, clientNonce: `game-invite:${match.id}`, kind: "GAME", gameId: match.id, body: `Let's play ${GAME_LABEL[match.kind]}` } });
      await bumpTogether(tx, context.couple.id); return match;
    }
    const match = await tx.gameMatch.findFirst({ where: { id: input.id, coupleId: context.couple.id } });
    if (!match) throw new NotFoundError();
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
      if (outcome !== undefined) { data = { ...data, status: "FINISHED", finishedAt: new Date(), ...(outcome !== "draw" ? { winner: { connect: { id: outcome === 0 ? match.playerOneId : match.playerTwoId } } } : {}) };
        await tx.chatMessage.create({ data: { coupleId: context.couple.id, senderId: context.user.id, clientNonce: `game-result:${match.id}`, kind: "GAME", gameId: match.id,
          body: `${GAME_LABEL[match.kind]} · ${outcome === "draw" ? "Draw" : `${outcome === (side === 0 ? 0 : 1) ? context.user.name : context.partner.name} won`}` } });
      }
    }
    const updated = await tx.gameMatch.update({ where: { id: match.id }, data });
    await bumpTogether(tx, context.couple.id); return updated;
  });
  return gameDTO(result, context.user.id);
}
