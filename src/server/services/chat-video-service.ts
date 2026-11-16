import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { videoActionSchema } from "@/lib/validation/chat-video";
import { VIDEO_CHUNK_BYTES, videoChunkCount } from "@/lib/together/video-policy";
import { assertChatKey } from "./chat-security-service";
import { requireTogether, withTogetherWrite, bumpTogether, type TogetherContext } from "./together-context";
import { checkMessageRate, imageSelect, messageDTO } from "./together-service";
import { queueStorageCleanup } from "./storage-cleanup-service";

const UPLOAD_LIFETIME = 24 * 60 * 60_000;
async function owned(tx: Prisma.TransactionClient, context: TogetherContext, id: string) {
  const row = await tx.chatVideo.findFirst({ where: { id, coupleId: context.couple.id, senderId: context.user.id } });
  if (!row) throw new NotFoundError("This video upload is no longer available. Choose it again.");
  await assertChatKey(tx, context, row.keyId);
  if (!row.messageId && row.expiresAt.getTime() <= Date.now()) throw new ConflictError("This upload expired. Choose the video again.");
  return row;
}
export async function actOnChatVideo(value: unknown) {
  const input = videoActionSchema.parse(value), context = await requireTogether();
  if (input.action === "start") return withTogetherWrite(context, async (tx) => {
    await assertChatKey(tx, context, input.keyId);
    if (JSON.parse(input.body).keyId !== input.keyId) throw new ValidationError("Use your current chat key.");
    const existing = await tx.chatVideo.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce: input.clientNonce } } });
    if (existing) {
      if (existing.coupleId !== context.couple.id || existing.byteLength !== input.byteLength || existing.body !== input.body) throw new ConflictError("Start a fresh video upload.");
      await owned(tx, context, existing.id);
      return { id: existing.id };
    }
    await checkMessageRate(tx, context.user.id);
    // Limit simultaneous unfinished work, never a couple's stored history.
    if (await tx.chatVideo.count({ where: { senderId: context.user.id, keyId: context.couple.chatKeyId!, messageId: null, expiresAt: { gt: new Date() } } }) >= 3) throw new ValidationError("Finish or cancel your other video uploads first.");
    const row = await tx.chatVideo.create({ data: { coupleId: context.couple.id, senderId: context.user.id,
      clientNonce: input.clientNonce, keyId: input.keyId, body: input.body, byteLength: input.byteLength,
      chunkCount: videoChunkCount(input.byteLength), expiresAt: new Date(Date.now() + UPLOAD_LIFETIME) }, select: { id: true } });
    return row;
  });
  if (input.action === "part") {
    const bytes = Buffer.from(input.data, "base64");
    if (bytes.toString("base64") !== input.data) throw new ValidationError("Invalid encrypted video chunk.");
    const digest = createHash("sha256").update(input.iv).update(bytes).digest("hex");
    const plan = await withTogetherWrite(context, async (tx) => {
      const row = await owned(tx, context, input.id);
      const expected = Math.min(VIDEO_CHUNK_BYTES, row.byteLength - input.index * VIDEO_CHUNK_BYTES) + 16;
      if (input.index >= row.chunkCount || bytes.length !== expected) throw new ValidationError("Invalid video chunk size.");
      const existing = await tx.chatVideoPart.findUnique({ where: { videoId_index: { videoId: row.id, index: input.index } } });
      if (existing) { if (existing.digest !== digest) throw new ConflictError("This chunk already has different data. Choose the video again."); return { done: true, key: existing.storageKey }; }
      if (row.messageId) throw new ConflictError("This video has already been sent.");
      const key = `couples/${context.couple.id}/chat-videos/${row.id}/${input.index}-${digest}.bin`;
      await queueStorageCleanup([key], row.expiresAt, tx);
      return { done: false, key };
    });
    if (plan.done) return { ok: true };
    // Network I/O stays outside the database lock. Immutable digest keys make retries safe.
    try {
      await storage.put({ key: plan.key, body: bytes, contentType: "application/octet-stream" });
      await withTogetherWrite(context, async (tx) => {
        const row = await owned(tx, context, input.id);
        const existing = await tx.chatVideoPart.findUnique({ where: { videoId_index: { videoId: row.id, index: input.index } } });
        if (existing) { if (existing.digest !== digest) throw new ConflictError("This chunk changed. Choose the video again."); return; }
        if (row.messageId) throw new ConflictError("This video has already been sent.");
        await tx.chatVideoPart.create({ data: { videoId: row.id, index: input.index, storageKey: plan.key, byteLength: bytes.length, iv: input.iv, digest } });
      });
    } catch (error) {
      // A reset/cancel can delete the first cleanup job while this upload is in flight.
      // Requeue after the final write so a late object cannot become an orphan.
      await queueStorageCleanup([plan.key], new Date());
      throw error;
    }
    return { ok: true };
  }
  return withTogetherWrite(context, async (tx) => {
    const row = await owned(tx, context, input.id);
    if (input.action === "cancel") {
      if (row.messageId) throw new ConflictError("This video was already sent. Use Delete for everyone in chat.");
      const parts = await tx.chatVideoPart.findMany({ where: { videoId: row.id }, select: { storageKey: true } });
      await queueStorageCleanup(parts.map((p) => p.storageKey), new Date(), tx);
      await tx.chatVideo.delete({ where: { id: row.id } });
      return { ok: true };
    }
    if (row.messageId) {
      const message = await tx.chatMessage.findUniqueOrThrow({ where: { id: row.messageId }, include: { image: { select: imageSelect } } });
      return messageDTO(message, context.user.id);
    }
    const parts = await tx.chatVideoPart.aggregate({ where: { videoId: row.id }, _count: { _all: true }, _sum: { byteLength: true } });
    if (parts._count._all !== row.chunkCount || parts._sum.byteLength !== row.byteLength + row.chunkCount * 16) throw new ValidationError("Some video chunks are missing. Retry to continue the upload.");
    await checkMessageRate(tx, context.user.id);
    const revision = (await bumpTogether(tx, context.couple.id)).togetherRevision;
    const message = await tx.chatMessage.create({ data: { coupleId: row.coupleId, generation: context.couple.chatGeneration, senderId: row.senderId, clientNonce: row.clientNonce,
      kind: "VIDEO", body: row.body, encrypted: true, revision }, include: { image: { select: imageSelect } } });
    await tx.chatVideo.update({ where: { id: row.id }, data: { messageId: message.id } });
    return messageDTO(message, context.user.id);
  });
}

export async function readChatVideo(messageId: string, index?: number) {
  const context = await requireTogether();
  const read = () => prisma.chatVideo.findFirst({ where: { messageId, coupleId: context.couple.id,
    message: { generation: context.couple.chatGeneration, deletedAt: null, NOT: { hiddenFor: { has: context.user.id } } } }, select: { id: true, chunkCount: true, byteLength: true } });
  const row = await read();
  if (!row) throw new NotFoundError("Video unavailable.");
  if (index == null) return { chunkCount: row.chunkCount, byteLength: row.byteLength };
  if (!Number.isInteger(index) || index < 0 || index >= row.chunkCount) throw new NotFoundError();
  const part = await prisma.chatVideoPart.findUnique({ where: { videoId_index: { videoId: row.id, index } } });
  if (!part) throw new NotFoundError();
  const bytes = await storage.get(part.storageKey);
  // Recheck deletion/disconnection after external storage I/O.
  const latest = await requireTogether();
  if (latest.couple.id !== context.couple.id || latest.couple.chatGeneration !== context.couple.chatGeneration || !await read()) throw new NotFoundError();
  return { iv: part.iv, data: bytes.toString("base64") };
}
