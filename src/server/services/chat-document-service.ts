import "server-only";
import { ConflictError, ValidationError } from "@/lib/errors";
import { encryptedDocumentSchema } from "@/lib/validation/chat-security";
import { assertChatKey } from "./chat-security-service";
import { requireTogether, withTogetherWrite, bumpTogether } from "./together-context";
import { checkMessageRate, imageSelect, messageDTO } from "./together-service";

export async function sendEncryptedDocument(value: unknown) {
  const input = encryptedDocumentSchema.parse(value), context = await requireTogether();
  const bytes = new Uint8Array(Buffer.from(input.data, "base64"));
  if (bytes.length < 17 || bytes.length > 2 * 1024 * 1024 + 16 || JSON.parse(input.body).keyId !== input.keyId) throw new ValidationError("Use the matching chat key and a document up to 2 MB.");
  const row = await withTogetherWrite(context, async (tx) => {
    await assertChatKey(tx, context, input.keyId);
    const existing = await tx.chatMessage.findUnique({ where: { senderId_clientNonce: { senderId: context.user.id, clientNonce: input.clientNonce } }, include: { image: { select: imageSelect } } });
    if (existing) { if (existing.coupleId !== context.couple.id || existing.generation !== context.couple.chatGeneration || existing.kind !== "DOCUMENT") throw new ConflictError("Start a new document message."); return existing; }
    await checkMessageRate(tx, context.user.id);
    const message = await tx.chatMessage.create({ data: { coupleId: context.couple.id, generation: context.couple.chatGeneration, senderId: context.user.id, kind: "DOCUMENT", encrypted: true, clientNonce: input.clientNonce, body: input.body,
      image: { create: { coupleId: context.couple.id, bytes, byteLength: bytes.length, width: 1, height: 1, contentType: "application/octet-stream", encrypted: true, iv: input.iv, viewLimit: 0 } } }, include: { image: { select: imageSelect } } });
    await bumpTogether(tx, context.couple.id); return message;
  });
  return messageDTO(row, context.user.id);
}
