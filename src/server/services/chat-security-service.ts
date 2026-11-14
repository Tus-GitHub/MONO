import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { chatActionSchema, chatKeyIdSchema, encryptedImageSchema, migrateChatSchema } from "@/lib/validation/chat-security";
import { CHAT_IMAGE_LIMIT, CHAT_IMAGE_SPACE } from "@/lib/together/catalog";
import { requireTogether, withTogetherWrite, bumpTogether, type TogetherContext } from "./together-context";
import { checkMessageRate, imageSelect, messageDTO } from "./together-service";

export async function assertChatKey(tx: Prisma.TransactionClient, context: TogetherContext, keyId: string) {
  const couple = await tx.couple.findUniqueOrThrow({ where: { id: context.couple.id }, select: { chatKeyId: true } });
  if (!couple.chatKeyId || couple.chatKeyId !== keyId) throw new ConflictError("Unlock encrypted chat with the matching recovery code first.");
}
export async function registerChatKey(value: unknown) {
  const id = chatKeyIdSchema.parse(value), context = await requireTogether();
  return withTogetherWrite(context, async (tx) => {
    const couple = await tx.couple.findUniqueOrThrow({ where: { id: context.couple.id } });
    if (couple.chatKeyId && couple.chatKeyId !== id) throw new ConflictError("Your partner already secured this chat. Use their recovery code.");
    await tx.couple.update({ where: { id: couple.id }, data: { chatKeyId: id } });
    await bumpTogether(tx, couple.id);
    return { keyId: id };
  });
}
function imageBytes(data: string) {
  const bytes = Buffer.from(data, "base64");
  if (bytes.length < 17 || bytes.length > CHAT_IMAGE_LIMIT + 16) throw new ValidationError("Choose a smaller photo (up to 512 KB after compression).");
  return new Uint8Array(bytes);
}
export async function sendEncryptedImage(value: unknown) {
  const input = encryptedImageSchema.parse(value), context = await requireTogether(), bytes = imageBytes(input.data);
  const row = await withTogetherWrite(context, async (tx) => {
    await assertChatKey(tx, context, input.keyId);
    const existing = await tx.chatMessage.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce: input.clientNonce } }, include: { image: { select: imageSelect } } });
    if (existing) { if (existing.coupleId !== context.couple.id || existing.kind !== "IMAGE") throw new ConflictError("Start a fresh image message."); return existing; }
    await checkMessageRate(tx, context.user.id);
    const used = await tx.chatImage.aggregate({ where: { coupleId: context.couple.id }, _sum: { byteLength: true } });
    if ((used._sum.byteLength ?? 0) + bytes.length > CHAT_IMAGE_SPACE) throw new ValidationError("Your shared chat image storage is full (25 MB).");
    const result = await tx.chatMessage.create({ data: { coupleId: context.couple.id, senderId: context.user.id, kind: "IMAGE", encrypted: true, clientNonce: input.clientNonce,
      image: { create: { coupleId: context.couple.id, bytes, byteLength: bytes.length, width: input.width, height: input.height, contentType: "image/jpeg", encrypted: true, iv: input.iv, viewLimit: input.viewLimit } } }, include: { image: { select: imageSelect } } });
    await bumpTogether(tx, context.couple.id); return result;
  });
  return messageDTO(row, context.user.id);
}
export async function changeChatMessage(value: unknown) {
  const input = chatActionSchema.parse(value), context = await requireTogether();
  const row = await withTogetherWrite(context, async (tx) => {
    const message = await tx.chatMessage.findFirst({ where: { id: input.id, coupleId: context.couple.id }, include: { image: { select: imageSelect } } });
    if (!message) throw new NotFoundError();
    if (input.action !== "delete-me" && (message.senderId !== context.user.id || message.hiddenFor.includes(context.user.id))) throw new NotFoundError();
    if (input.action === "delete-me" && message.hiddenFor.includes(context.user.id)) return message;
    if (input.action === "delete-everyone" && message.deletedAt) return message;
    const revision = (await bumpTogether(tx, context.couple.id)).togetherRevision;
    let data: Prisma.ChatMessageUpdateInput;
    if (input.action === "edit") {
      if (message.deletedAt || message.kind !== "TEXT" || !message.encrypted) throw new ValidationError("Only your encrypted text messages can be edited.");
      if (message.version !== input.version) throw new ConflictError("This message changed. Reopen it before editing.");
      await assertChatKey(tx, context, JSON.parse(input.body).keyId);
      data = { body: input.body, editedAt: new Date() };
    } else if (input.action === "delete-me") data = { hiddenFor: { push: context.user.id } };
    else {
      await tx.chatImage.deleteMany({ where: { messageId: message.id } });
      data = { body: "", deletedAt: new Date() };
    }
    return tx.chatMessage.update({ where: { id: message.id }, data: { ...data, version: { increment: 1 }, revision }, include: { image: { select: imageSelect } } });
  });
  return messageDTO(row, context.user.id);
}
// All media access is authorized and serialized with deletion and view consumption.
// GET never consumes a view; only an explicit POST may release limited-view ciphertext.
export async function readChatImage(id: string, consume: boolean, migration = false) {
  const context = await requireTogether();
  return withTogetherWrite(context, async (tx) => {
    const row = await tx.chatMessage.findFirst({ where: { id, coupleId: context.couple.id }, include: { image: true } });
    if (!row || row.deletedAt || (row.hiddenFor.includes(context.user.id) && !(migration && !row.encrypted)) || !row.image) throw new NotFoundError();
    const image = row.image;
    if (image.viewLimit > 0) {
      if (!consume) throw new ValidationError("Open this limited-view photo from the chat.");
      if (row.senderId !== context.user.id) {
        if (image.viewsUsed >= image.viewLimit) throw new ValidationError("This photo has no views remaining.");
        image.viewsUsed += 1;
        await tx.chatImage.update({ where: { messageId: id }, data: { viewsUsed: image.viewsUsed } });
        const revision = (await bumpTogether(tx, context.couple.id)).togetherRevision;
        await tx.chatMessage.update({ where: { id }, data: { revision, version: { increment: 1 } } });
      }
    }
    return image;
  });
}
export async function legacyChatPage() {
  const context = await requireTogether();
  const rows = await prisma.chatMessage.findMany({ where: { coupleId: context.couple.id, encrypted: false, deletedAt: null }, orderBy: { sequence: "asc" }, take: 20, include: { image: { select: imageSelect } } });
  // Either authenticated partner may migrate history, including locally hidden messages.
  return rows.map((row) => messageDTO({ ...row, hiddenFor: [] }, context.user.id));
}
export async function migrateChatMessage(value: unknown) {
  const input = migrateChatSchema.parse(value), context = await requireTogether();
  return withTogetherWrite(context, async (tx) => {
    await assertChatKey(tx, context, JSON.parse(input.body).keyId);
    const row = await tx.chatMessage.findFirst({ where: { id: input.id, coupleId: context.couple.id }, include: { image: true } });
    if (!row || row.deletedAt) throw new NotFoundError();
    if (row.encrypted) return { migrated: true };
    if (row.version !== input.version) throw new ConflictError("This message changed. Retry securing history.");
    if (Boolean(row.image) !== Boolean(input.image)) throw new ValidationError("Secure the photo together with its message.");
    if (input.image) {
      if (input.image.keyId !== context.couple.chatKeyId) throw new ValidationError("Use the matching photo key.");
      const bytes = imageBytes(input.image.data);
      await tx.chatImage.update({ where: { messageId: row.id }, data: { bytes, byteLength: bytes.length, encrypted: true, iv: input.image.iv, width: input.image.width, height: input.image.height } });
    }
    const revision = (await bumpTogether(tx, context.couple.id)).togetherRevision;
    await tx.chatMessage.update({ where: { id: row.id }, data: { body: input.body, encrypted: true, revision, version: { increment: 1 } } });
    return { migrated: true };
  });
}
