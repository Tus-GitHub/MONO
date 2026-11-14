import { describe, expect, it } from "vitest";
import { chatAAD, decryptBytes, decryptText, encryptBytes, encryptText, newRecoveryCode, recoverChatKey, unbase64, base64 } from "./chat-crypto";
import { encryptedBodySchema, secureMessageSchema, encryptedImageSchema } from "../validation/chat-security";

describe("chat encryption", () => {
  it("recovers the same nonextractable key on another device and encrypts Unicode content", async () => {
    const code = newRecoveryCode(), a = await recoverChatKey(code, "couple-a"), b = await recoverChatKey(code, "couple-a");
    expect(a.id).toBe(b.id); expect(a.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", a.key)).rejects.toThrow();
    const aad = chatAAD("couple-a", "sender", "nonce", "TEXT"), secret = "Meet at 8 ❤️ 私たち";
    const body = await encryptText(a, secret, aad);
    expect(body).not.toContain(secret); expect(encryptedBodySchema.safeParse(body).success).toBe(true);
    expect(await decryptText(b, body, aad)).toBe(secret);
    expect(await encryptText(a, secret, aad)).not.toBe(body);
  });
  it("rejects wrong secrets, another couple, altered bytes and moved message context", async () => {
    const code = newRecoveryCode(), a = await recoverChatKey(code, "one"), other = await recoverChatKey(code, "two");
    const aad = chatAAD("one", "alice", "nonce", "TEXT"), body = await encryptText(a, "private", aad);
    await expect(decryptText(other, body, aad)).rejects.toThrow();
    await expect(decryptText(await recoverChatKey(newRecoveryCode(), "one"), body, aad)).rejects.toThrow();
    await expect(decryptText(a, body, chatAAD("one", "mallory", "nonce", "TEXT"))).rejects.toThrow();
    const changed = JSON.parse(body), bytes = unbase64(changed.data); bytes[0] ^= 1; changed.data = base64(bytes);
    await expect(decryptText(a, JSON.stringify(changed), aad)).rejects.toThrow();
  });
  it("encrypts image bytes and authenticates the photo view mode", async () => {
    const key = await recoverChatKey(newRecoveryCode(), "space"), bytes = crypto.getRandomValues(new Uint8Array(10000));
    const aad = chatAAD("space", "sender", "nonce", "IMAGE_BYTES:1");
    const image = await encryptBytes(key, bytes, aad);
    expect(unbase64(image.data)).not.toEqual(bytes);
    expect(await decryptBytes(key, image, aad)).toEqual(bytes);
    await expect(decryptBytes(key, image, chatAAD("space", "sender", "nonce", "IMAGE_BYTES:0"))).rejects.toThrow();
  });
  it("rejects plaintext writes, weak recovery codes and invalid view limits", async () => {
    await expect(recoverChatKey("our-password", "couple")).rejects.toThrow();
    expect(secureMessageSchema.safeParse({ kind: "TEXT", body: "plaintext", clientNonce: crypto.randomUUID() }).success).toBe(false);
    expect(encryptedBodySchema.safeParse(JSON.stringify({ v: 1, keyId: "00".repeat(32), iv: "short", data: "not encrypted" })).success).toBe(false);
    expect(encryptedImageSchema.safeParse({ clientNonce: crypto.randomUUID(), keyId: "00".repeat(32), iv: "A".repeat(16), data: "A".repeat(24), width: 1, height: 1, viewLimit: 3 }).success).toBe(false);
  });
});
