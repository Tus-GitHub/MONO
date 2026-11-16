import { z } from "zod";
import { chatAAD, decryptBytes, decryptText, encryptBytes, encryptText, type ChatKey } from "./chat-crypto";
import type { MessageDTO } from "./types";
import { togetherFetch } from "./client";

export const STICKER_LIMIT = 256 * 1024;
export const STICKER_EDGE = 512;
export const stickerMetadataSchema = z.object({
  type: z.literal("mono.sticker.v1"), id: z.string().uuid(), name: z.string().trim().min(1).max(40),
}).strict();
export type StickerMetadata = z.infer<typeof stickerMetadataSchema>;
export interface PreparedSticker { id: string; bytes: Uint8Array; width: number; height: number }
export interface LibrarySticker { message: MessageDTO; metadata: StickerMetadata }

export function readStickerMetadata(body: string): StickerMetadata | null {
  try { const result = stickerMetadataSchema.safeParse(JSON.parse(body)); return result.success ? result.data : null; }
  catch { return null; }
}

export async function encryptSticker(sticker: PreparedSticker, name: string, key: ChatKey, coupleId: string, senderId: string, clientNonce: string) {
  const metadata = stickerMetadataSchema.parse({ type: "mono.sticker.v1", id: sticker.id, name });
  if (!sticker.bytes.length || sticker.bytes.length > STICKER_LIMIT || sticker.width < 1 || sticker.height < 1
    || sticker.width > STICKER_EDGE || sticker.height > STICKER_EDGE) throw new Error("Choose a smaller sticker.");
  return { ...await encryptBytes(key, sticker.bytes, chatAAD(coupleId, senderId, clientNonce, "STICKER_BYTES")),
    body: await encryptText(key, JSON.stringify(metadata), chatAAD(coupleId, senderId, clientNonce, "STICKER")),
    keyId: key.id, clientNonce, width: sticker.width, height: sticker.height };
}

/** IDs and names stay inside encrypted metadata; deduplication happens only on the device. */
export async function stickerLibrary(messages: MessageDTO[], key: ChatKey, coupleId: string): Promise<LibrarySticker[]> {
  const decoded = await Promise.all(messages.map(async (message) => {
    if (message.kind !== "STICKER" || !message.image || message.deleted || message.hidden || !message.encrypted) return null;
    try {
      const metadata = readStickerMetadata(await decryptText(key, message.body, chatAAD(coupleId, message.senderId, message.clientNonce, "STICKER")));
      return metadata ? { message, metadata } : null;
    } catch { return null; }
  }));
  const unique = new Map<string, LibrarySticker>();
  for (const sticker of decoded) if (sticker && !unique.has(sticker.metadata.id)) unique.set(sticker.metadata.id, sticker);
  return [...unique.values()].slice(0, 32);
}

export type StickerSource = Pick<MessageDTO, "kind" | "senderId" | "clientNonce"> & {
  image: Pick<NonNullable<MessageDTO["image"]>, "url" | "encrypted" | "contentType" | "viewLimit"> | null;
};
export async function readStickerPixels(message: StickerSource, key: ChatKey, coupleId: string, signal?: AbortSignal) {
  if (message.kind !== "STICKER" || !message.image?.encrypted || message.image.contentType !== "image/png" || message.image.viewLimit !== 0) throw new Error("This sticker is unavailable.");
  const envelope = await togetherFetch<{ iv: string; data: string }>(message.image.url, { signal });
  return decryptBytes(key, envelope, chatAAD(coupleId, message.senderId, message.clientNonce, "STICKER_BYTES"));
}
