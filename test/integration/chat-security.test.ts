import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"); const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { sendChatMessage, togetherSnapshot } from "@/server/services/together-service";
import { changeChatMessage, legacyChatPage, migrateChatMessage, readChatImage, registerChatKey, sendEncryptedImage } from "@/server/services/chat-security-service";
import { chatAAD, decryptBytes, decryptText, encryptBytes, encryptText, newRecoveryCode, recoverChatKey, type ChatKey } from "@/lib/together/chat-crypto";
import { POST as consumePOST } from "@/app/api/together/images/[id]/route";
let owner: string, partner: string, outsider: string, otherPartner: string, couple: string, otherCouple: string, key: ChatKey;
beforeEach(async () => {
  const run = randomUUID();
  const make = async (role: string) => {
    const a = await prisma.user.create({ data: { name: `${role}-a-${run}`, email: `${role}-a-${run}@example.invalid`, emailVerified: new Date() } });
    const b = await prisma.user.create({ data: { name: `${role}-b-${run}`, email: `${role}-b-${run}@example.invalid`, emailVerified: new Date() } });
    const space = await prisma.couple.create({ data: { createdById: a.id, inviteCode: `${role}-${run}`, status: "ACTIVE", members: { create: [{ userId: a.id, role: "OWNER", status: "ACTIVE" }, { userId: b.id, role: "PARTNER", status: "ACTIVE" }] } } });
    return { a: a.id, b: b.id, space: space.id };
  };
  const own = await make("security"), other = await make("foreign"); owner = own.a; partner = own.b; couple = own.space; outsider = other.a; otherPartner = other.b; otherCouple = other.space;
  key = await recoverChatKey(newRecoveryCode(), couple);
  await asUser(owner, () => registerChatKey(key.id));
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider, otherPartner].filter(Boolean) } } });
});
afterAll(() => prisma.$disconnect());
async function send(secret = "only us") {
  const clientNonce = randomUUID();
  return asUser(owner, async () => sendChatMessage({ kind: "TEXT", clientNonce, body: await encryptText(key, secret, chatAAD(couple, owner, clientNonce, "TEXT")) }));
}
async function photo(viewLimit: 0 | 1 | 2) {
  const clientNonce = randomUUID(), bytes = new TextEncoder().encode("private photo bytes that the server cannot decode");
  const payload = { ...await encryptBytes(key, bytes, chatAAD(couple, owner, clientNonce, `IMAGE_BYTES:${viewLimit}`)), keyId: key.id, clientNonce, width: 1, height: 1, viewLimit };
  const row = await asUser(owner, () => sendEncryptedImage(payload)); return { row, bytes, payload };
}
it("persists only encrypted text and rejects plaintext/downgrade writes and key replacement", async () => {
  const row = await send("a secret sentence");
  const stored = await prisma.chatMessage.findUniqueOrThrow({ where: { id: row.id } });
  expect(stored.encrypted).toBe(true); expect(stored.body).not.toContain("a secret sentence");
  const received = (await asUser(partner, () => togetherSnapshot())).messages[0];
  expect(await decryptText(key, received.body, chatAAD(couple, owner, row.clientNonce, "TEXT"))).toBe("a secret sentence");
  await expect(asUser(owner, () => sendChatMessage({ kind: "TEXT", body: "plaintext", clientNonce: randomUUID() }))).rejects.toThrow();
  await expect(asUser(partner, () => registerChatKey("ff".repeat(32)))).rejects.toThrow(/already/);
  expect((await asUser(outsider, () => togetherSnapshot())).messages).toEqual([]);
});
it("edits only the author's text, detects stale edits, and synchronizes updates below the message cursor", async () => {
  const row = await send(), before = await asUser(partner, () => togetherSnapshot());
  const body = await encryptText(key, "edited secret", chatAAD(couple, owner, row.clientNonce, "TEXT"));
  await expect(asUser(partner, () => changeChatMessage({ action: "edit", id: row.id, version: 0, body }))).rejects.toThrow();
  const edited = await asUser(owner, () => changeChatMessage({ action: "edit", id: row.id, version: 0, body }));
  expect(edited.editedAt).not.toBeNull(); expect(edited.version).toBe(1);
  await expect(asUser(owner, () => changeChatMessage({ action: "edit", id: row.id, version: 0, body }))).rejects.toThrow(/changed/);
  const next = await asUser(partner, () => togetherSnapshot({ after: BigInt(before.cursor), revision: before.revision }));
  expect(next.messages).toEqual([]); expect(next.updates?.[0].body).toBe(body);
});
it("delete for me persists only for that user; delete for everyone erases ciphertext and media", async () => {
  const { row } = await photo(0);
  await asUser(partner, () => changeChatMessage({ action: "delete-me", id: row.id }));
  expect((await asUser(partner, () => togetherSnapshot())).messages[0]).toMatchObject({ hidden: true, body: "", image: null });
  await expect(asUser(partner, () => readChatImage(row.id, false))).rejects.toThrow();
  expect((await asUser(owner, () => togetherSnapshot())).messages[0].hidden).toBe(false);
  await expect(asUser(outsider, () => changeChatMessage({ action: "delete-everyone", id: row.id }))).rejects.toThrow();
  await asUser(owner, () => changeChatMessage({ action: "delete-everyone", id: row.id }));
  expect(await prisma.chatImage.count({ where: { messageId: row.id } })).toBe(0);
  expect((await prisma.chatMessage.findUniqueOrThrow({ where: { id: row.id } })).body).toBe("");
  await expect(asUser(owner, () => readChatImage(row.id, false))).rejects.toThrow();
});
it.each([1, 2] as const)("enforces exactly %i recipient photo views under concurrent opens", async (limit) => {
  const { row, bytes } = await photo(limit);
  await expect(asUser(partner, () => readChatImage(row.id, false))).rejects.toThrow(/Open/);
  await expect(asUser(outsider, () => readChatImage(row.id, true))).rejects.toThrow();
  await asUser(owner, () => readChatImage(row.id, true)); // Sender preview consumes none.
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => asUser(partner, () => readChatImage(row.id, true))));
  const allowed = results.filter((r) => r.status === "fulfilled"); expect(allowed).toHaveLength(limit);
  for (const result of allowed) if (result.status === "fulfilled") {
    expect(await decryptBytes(key, { iv: result.value.iv!, data: Buffer.from(result.value.bytes).toString("base64") }, chatAAD(couple, owner, row.clientNonce, `IMAGE_BYTES:${limit}`))).toEqual(bytes);
  }
  expect((await prisma.chatImage.findUniqueOrThrow({ where: { messageId: row.id } })).viewsUsed).toBe(limit);
  await expect(asUser(partner, () => readChatImage(row.id, true))).rejects.toThrow(/no views/);
});
it("does not consume views on cross-origin requests, and deduplicates image send retries", async () => {
  const { row, payload } = await photo(1);
  expect((await asUser(owner, () => sendEncryptedImage(payload))).id).toBe(row.id);
  const result = await asUser(partner, () => consumePOST(new Request(`http://localhost:3000/api/together/images/${row.id}`, { method: "POST", headers: { origin: "https://foreign.invalid" } }), { params: Promise.resolve({ id: row.id }) }));
  expect(result.status).toBe(403);
  expect((await prisma.chatImage.findUniqueOrThrow({ where: { messageId: row.id } })).viewsUsed).toBe(0);
});
it("migrates legacy history atomically, preserves failed rows and makes replay harmless", async () => {
  const legacy = await prisma.chatMessage.create({ data: { coupleId: couple, senderId: owner, clientNonce: randomUUID(), kind: "TEXT", body: "old plaintext" } });
  const body = await encryptText(key, legacy.body, chatAAD(couple, owner, legacy.clientNonce, "TEXT"));
  await expect(asUser(owner, () => migrateChatMessage({ id: legacy.id, version: 4, body }))).rejects.toThrow();
  expect((await prisma.chatMessage.findUniqueOrThrow({ where: { id: legacy.id } })).body).toBe("old plaintext");
  await expect(asUser(outsider, () => migrateChatMessage({ id: legacy.id, version: 0, body }))).rejects.toThrow();
  await asUser(partner, () => migrateChatMessage({ id: legacy.id, version: 0, body }));
  await asUser(partner, () => migrateChatMessage({ id: legacy.id, version: 0, body }));
  const stored = await prisma.chatMessage.findUniqueOrThrow({ where: { id: legacy.id } });
  expect(stored.body).toBe(body); expect(stored.encrypted).toBe(true);
  expect(await asUser(owner, legacyChatPage)).toEqual([]);
});
it("denies media and mutations after a partner leaves", async () => {
  const { row } = await photo(2);
  await prisma.coupleMember.updateMany({ where: { coupleId: couple, userId: partner }, data: { status: "LEFT" } });
  await expect(asUser(partner, () => readChatImage(row.id, true))).rejects.toThrow();
  await expect(asUser(owner, () => changeChatMessage({ action: "delete-everyone", id: row.id }))).rejects.toThrow();
});
it("migrates a hidden legacy photo together with its encrypted message and preserves bytes on failure", async () => {
  const oldBytes = new TextEncoder().encode("legacy image bytes");
  const row = await prisma.chatMessage.create({ data: { coupleId: couple, senderId: owner, clientNonce: randomUUID(), kind: "IMAGE", hiddenFor: [partner], image: { create: { coupleId: couple, bytes: oldBytes, byteLength: oldBytes.length, contentType: "image/png", width: 1, height: 1 } } } });
  const body = await encryptText(key, "", chatAAD(couple, owner, row.clientNonce, "IMAGE"));
  await expect(asUser(partner, () => migrateChatMessage({ id: row.id, version: 0, body }))).rejects.toThrow(/photo/);
  expect((await prisma.chatImage.findUniqueOrThrow({ where: { messageId: row.id } })).bytes).toEqual(oldBytes);
  await expect(asUser(partner, () => readChatImage(row.id, false))).rejects.toThrow();
  expect((await asUser(partner, () => readChatImage(row.id, false, true))).bytes).toEqual(oldBytes);
  const image = { ...await encryptBytes(key, oldBytes, chatAAD(couple, owner, row.clientNonce, "IMAGE_BYTES:0")), keyId: key.id, width: 1, height: 1 };
  await asUser(partner, () => migrateChatMessage({ id: row.id, version: 0, body, image }));
  const stored = await prisma.chatImage.findUniqueOrThrow({ where: { messageId: row.id } });
  expect(stored.encrypted).toBe(true); expect(stored.bytes).not.toEqual(oldBytes);
  await expect(asUser(partner, () => readChatImage(row.id, false, true))).rejects.toThrow();
  expect(await decryptBytes(key, { iv: stored.iv!, data: Buffer.from(stored.bytes).toString("base64") }, chatAAD(couple, owner, row.clientNonce, "IMAGE_BYTES:0"))).toEqual(oldBytes);
});
it("pages more than sixty older mutations without skipping changes", async () => {
  await prisma.chatMessage.createMany({ data: Array.from({ length: 65 }, (_, i) => ({ coupleId: couple, senderId: owner, clientNonce: `revision-${i}`, kind: "TEXT", encrypted: true, body: "", revision: BigInt(i + 2), version: 1, deletedAt: new Date() })) });
  await prisma.couple.update({ where: { id: couple }, data: { togetherRevision: BigInt(66) } });
  const latest = await asUser(partner, () => togetherSnapshot());
  const first = await asUser(partner, () => togetherSnapshot({ after: BigInt(latest.cursor), revision: "1" }));
  expect(first.updates).toHaveLength(60); expect(first.revision).toBe("61");
  const rest = await asUser(partner, () => togetherSnapshot({ after: BigInt(first.cursor), revision: first.revision }));
  expect(rest.updates).toHaveLength(5); expect(rest.revision).toBe("66");
});
