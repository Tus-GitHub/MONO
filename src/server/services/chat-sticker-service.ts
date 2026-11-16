import "server-only";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, ValidationError } from "@/lib/errors";
import { STICKER_LIMIT } from "@/lib/together/stickers";
import { encryptedStickerSchema } from "@/lib/validation/chat-security";
import { assertChatKey } from "./chat-security-service";
import { bumpTogether, requireTogether, withTogetherWrite } from "./together-context";
import { checkMessageRate, imageSelect, messageDTO } from "./together-service";

/** Shared sticker history reuses the existing encrypted message/media storage and deletion rules. */
export async function listChatStickers() {
  const context = await requireTogether();
  const messages = await prisma.chatMessage.findMany({ where: {
    coupleId: context.couple.id, kind: "STICKER", encrypted: true, deletedAt: null,
    NOT: { hiddenFor: { has: context.user.id } }, image: { is: { encrypted: true, viewLimit: 0, contentType: "image/png" } },
  }, orderBy: { sequence: "desc" }, take: 120, include: { image: { select: imageSelect } } });
  return messages.map((row) => messageDTO(row, context.user.id));
}

export async function sendEncryptedSticker(value: unknown) {
  const input = encryptedStickerSchema.parse(value), context = await requireTogether();
  const bytes = new Uint8Array(Buffer.from(input.data, "base64"));
  if (bytes.length < 17 || bytes.length > STICKER_LIMIT + 16 || JSON.parse(input.body).keyId !== input.keyId) throw new ValidationError("Use the matching chat key and a sticker up to 256 KB.");
  const row = await withTogetherWrite(context, async (tx) => {
    await assertChatKey(tx, context, input.keyId);
    const existing = await tx.chatMessage.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce: input.clientNonce } }, include: { image: { select: imageSelect } } });
    if (existing) {
      if (existing.coupleId !== context.couple.id || existing.kind !== "STICKER" || !existing.image) throw new ConflictError("Start a fresh sticker message.");
      return existing;
    }
    await checkMessageRate(tx, context.user.id);
    const message = await tx.chatMessage.create({ data: { coupleId: context.couple.id, senderId: context.user.id, kind: "STICKER", encrypted: true, clientNonce: input.clientNonce, body: input.body,
      image: { create: { coupleId: context.couple.id, bytes, byteLength: bytes.length, width: input.width, height: input.height, contentType: "image/png", encrypted: true, iv: input.iv, viewLimit: 0 } },
    }, include: { image: { select: imageSelect } } });
    await bumpTogether(tx, context.couple.id);
    return message;
  });
  return messageDTO(row, context.user.id);
}
