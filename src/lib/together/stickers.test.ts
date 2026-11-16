import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chatAAD, decryptBytes, decryptText, newRecoveryCode, recoverChatKey } from "./chat-crypto";
import { encryptSticker, readStickerMetadata, stickerLibrary, STICKER_LIMIT } from "./stickers";
import type { MessageDTO } from "./types";
import { encryptedStickerSchema } from "@/lib/validation/chat-security";

describe("private custom stickers", () => {
  it("encrypts the name, stable library identity and pixels with distinct message-bound AAD", async () => {
    const key = await recoverChatKey(newRecoveryCode(), "couple"), nonce = randomUUID();
    const bytes = new TextEncoder().encode("private PNG bytes");
    const payload = await encryptSticker({ id: randomUUID(), bytes, width: 512, height: 512 }, "Our happy dance", key, "couple", "sender", nonce);
    expect(encryptedStickerSchema.safeParse(payload).success).toBe(true);
    expect(payload.body).not.toContain("happy dance");
    const metadata = readStickerMetadata(await decryptText(key, payload.body, chatAAD("couple", "sender", nonce, "STICKER")));
    expect(metadata?.name).toBe("Our happy dance");
    expect(await decryptBytes(key, payload, chatAAD("couple", "sender", nonce, "STICKER_BYTES"))).toEqual(bytes);
    await expect(decryptBytes(key, payload, chatAAD("foreign", "sender", nonce, "STICKER_BYTES"))).rejects.toThrow();
    await expect(decryptBytes(key, payload, chatAAD("couple", "sender", nonce, "IMAGE_BYTES:0"))).rejects.toThrow();
  });
  it("deduplicates reused stickers by their encrypted identity and ignores damaged or hidden rows", async () => {
    const key = await recoverChatKey(newRecoveryCode(), "couple"), id = randomUUID();
    const row = async (senderId: string): Promise<MessageDTO> => {
      const clientNonce = randomUUID(), payload = await encryptSticker({ id, bytes: new Uint8Array([1, 2, 3]), width: 128, height: 128 }, "Our sticker", key, "couple", senderId, clientNonce);
      return { id: randomUUID(), senderId, clientNonce, kind: "STICKER", encrypted: true, deleted: false, hidden: false, body: payload.body,
        sequence: "1", gameId: null, createdAt: new Date().toISOString(), version: 0, editedAt: null,
        image: { url: "/private", encrypted: true, width: 128, height: 128, contentType: "image/png", viewLimit: 0, viewsUsed: 0 } };
    };
    const newest = await row("partner"), older = await row("owner");
    const library = await stickerLibrary([newest, older, { ...older, body: "broken" }, { ...newest, hidden: true }], key, "couple");
    expect(library).toHaveLength(1); expect(library[0].message.id).toBe(newest.id);
    expect(await stickerLibrary([newest], key, "foreign")).toEqual([]);
  });
  it("validates sticker names, dimensions, payload size and encrypted-only metadata", async () => {
    expect(readStickerMetadata("love")).toBeNull();
    expect(readStickerMetadata(JSON.stringify({ type: "mono.sticker.v1", id: randomUUID(), name: " " }))).toBeNull();
    const key = await recoverChatKey(newRecoveryCode(), "couple");
    const make = (bytes: Uint8Array, width = 512) => encryptSticker({ id: randomUUID(), bytes, width, height: 512 }, "Our sticker", key, "couple", "sender", randomUUID());
    await expect(make(new Uint8Array(STICKER_LIMIT + 1))).rejects.toThrow("smaller");
    await expect(make(new Uint8Array(1), 513)).rejects.toThrow("smaller");
    const payload = await make(new Uint8Array(1));
    expect(encryptedStickerSchema.safeParse({ ...payload, body: "Our secret sticker name" }).success).toBe(false);
    expect(encryptedStickerSchema.safeParse({ ...payload, viewLimit: 1 }).success).toBe(false);
  });
});
