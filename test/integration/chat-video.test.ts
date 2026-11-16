import { randomUUID, createHash } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"), { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const objects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/lib/storage", () => ({ storage: {
  put: async ({ key, body }: { key: string; body: Buffer }) => { objects.set(key, Buffer.from(body)); },
  get: async (key: string) => { const bytes = objects.get(key); if (!bytes) throw new Error("Missing object"); return bytes; },
  delete: async (key: string) => { objects.delete(key); },
} }));
import { prisma } from "@/lib/db/prisma";
import { registerChatKey, changeChatMessage } from "@/server/services/chat-security-service";
import { actOnChatVideo, readChatVideo } from "@/server/services/chat-video-service";
import { adminCoupleStorage } from "@/server/services/admin-couple-storage";
import { processStorageCleanup, isActiveMediaKey } from "@/server/services/storage-cleanup-service";
import { VIDEO_CHUNK_BYTES, videoChunkAAD } from "@/lib/together/video-policy";
import { recoverChatKey, encryptBytes, encryptText, decryptBytes, chatAAD, type ChatKey } from "@/lib/together/chat-crypto";
let owner: string, partner: string, outsider: string, couple: string, otherCouple: string, key: ChatKey;
let ids: string[];
beforeEach(async () => {
  const run = randomUUID(); ids = [];
  for (let index = 0; index < 4; index++) ids.push((await prisma.user.create({ data: { name: `Video QA ${run}-${index}`, email: `video-${run}-${index}@example.invalid`, emailVerified: new Date() } })).id);
  [owner, partner, outsider] = ids;
  const make = async (pair: string[]) => (await prisma.couple.create({ data: { createdById: pair[0], inviteCode: randomUUID(), status: "ACTIVE", members: { create: pair.map((userId, index) => ({ userId, role: index ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } })).id;
  couple = await make(ids.slice(0, 2)); otherCouple = await make(ids.slice(2));
  key = await recoverChatKey("ab".repeat(32), couple); await asUser(owner, () => registerChatKey(key.id));
});
afterEach(async () => {
  await prisma.storageCleanup.deleteMany({ where: { OR: [couple, otherCouple].map((id) => ({ key: { startsWith: `couples/${id}/` } })) } });
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } }); objects.clear();
});
afterAll(() => prisma.$disconnect());
const act = (body: unknown, user = owner) => asUser(user, () => actOnChatVideo(body));
async function start(size = VIDEO_CHUNK_BYTES + 32) {
  const nonce = randomUUID(), count = Math.ceil(size / VIDEO_CHUNK_BYTES);
  const body = await encryptText(key, JSON.stringify({ name: "private-video.mp4", size, chunkCount: count }), chatAAD(couple, owner, nonce, "VIDEO"));
  const input = { action: "start", clientNonce: nonce, keyId: key.id, body, byteLength: size };
  const upload = await act(input) as { id: string };
  const parts = [];
  for (let index = 0; index < count; index++) {
    const plain = new Uint8Array(Math.min(VIDEO_CHUNK_BYTES, size - index * VIDEO_CHUNK_BYTES)).fill(index + 31);
    const encrypted = await encryptBytes(key, plain, chatAAD(couple, owner, nonce, videoChunkAAD(index, count)));
    parts.push({ action: "part", id: upload.id, index, ...encrypted });
  }
  return { ...upload, input, parts, nonce, count };
}
it("retries chunks and completion without duplicates, preserves E2EE and allows the partner to decrypt", async () => {
  const u = await start(); expect(await act(u.input)).toEqual({ id: u.id });
  await expect(act({ action: "finish", id: u.id })).rejects.toThrow(/missing/);
  for (const part of u.parts) { await act(part); await act(part); }
  const row = await act({ action: "finish", id: u.id }) as { id: string; kind: string };
  expect(row.kind).toBe("VIDEO"); expect(await act({ action: "finish", id: u.id })).toMatchObject({ id: row.id });
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(1);
  const raw = await prisma.$queryRaw<{ body: string }[]>`SELECT body FROM chat_videos WHERE id = ${u.id}`;
  expect(raw[0].body).not.toContain("private-video"); expect(raw[0].body).not.toBe(u.input.body);
  for (const [index, part] of u.parts.entries()) {
    const payload = await asUser(partner, () => readChatVideo(row.id, index)) as { iv: string; data: string };
    expect(payload).toEqual({ iv: part.iv, data: part.data });
    const plain = await decryptBytes(key, payload, chatAAD(couple, owner, u.nonce, videoChunkAAD(index, u.count)));
    expect(plain[0]).toBe(index + 31);
    await expect(decryptBytes(key, payload, chatAAD(couple, owner, u.nonce, videoChunkAAD(1 - index, u.count)))).rejects.toThrow();
  }
  const stored = [...objects.values()][0]; expect(createHash("sha256").update(stored).digest("hex")).not.toBe(createHash("sha256").update(new Uint8Array(VIDEO_CHUNK_BYTES).fill(31)).digest("hex"));
});
it("rejects foreign uploads, foreign reads, malformed sizes, changed chunks and key mismatch", async () => {
  const u = await start(32);
  await expect(act(u.parts[0], outsider)).rejects.toThrow(); await expect(act(u.parts[0], partner)).rejects.toThrow();
  await expect(act({ ...u.parts[0], data: Buffer.alloc(33).toString("base64") })).rejects.toThrow();
  await expect(act({ ...u.input, clientNonce: randomUUID(), keyId: "ff".repeat(32) })).rejects.toThrow();
  await act(u.parts[0]); await expect(act({ ...u.parts[0], iv: "AA".repeat(8) })).rejects.toThrow();
  const row = await act({ action: "finish", id: u.id }) as { id: string };
  await expect(asUser(outsider, () => readChatVideo(row.id))).rejects.toThrow();
  expect(await isActiveMediaKey([...objects.keys()][0])).toBe(false);
});
it("delete for me affects only that user, delete for everyone revokes access and cleanup removes bytes", async () => {
  const u = await start(32); await act(u.parts[0]); const row = await act({ action: "finish", id: u.id }) as { id: string };
  await asUser(partner, () => changeChatMessage({ action: "delete-me", id: row.id }));
  await expect(asUser(partner, () => readChatVideo(row.id))).rejects.toThrow();
  expect(await asUser(owner, () => readChatVideo(row.id))).toMatchObject({ byteLength: 32 });
  await asUser(owner, () => changeChatMessage({ action: "delete-everyone", id: row.id }));
  await expect(asUser(owner, () => readChatVideo(row.id))).rejects.toThrow();
  await processStorageCleanup({ now: new Date(Date.now() + 2 * 86400_000), limit: 50 }); expect(objects.size).toBe(0);
});
it("cancellation removes staged bytes and disconnection prevents finishing", async () => {
  const u = await start(32); await act(u.parts[0]); await act({ action: "cancel", id: u.id });
  await processStorageCleanup({ limit: 50 }); expect(objects.size).toBe(0); expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(0);
  const next = await start(32); await act(next.parts[0]);
  await prisma.coupleMember.updateMany({ where: { coupleId: couple, userId: partner }, data: { status: "LEFT" } });
  await expect(act({ action: "finish", id: next.id })).rejects.toThrow();
});
it("preserves live video objects across cleanup, then cleans them after a couple cascade", async () => {
  const u = await start(32); await act(u.parts[0]); await act({ action: "finish", id: u.id });
  await processStorageCleanup({ now: new Date(Date.now() + 2 * 86400_000), limit: 50 }); expect(objects.size).toBe(1);
  await prisma.couple.delete({ where: { id: couple } });
  await processStorageCleanup({ now: new Date(Date.now() + 10 * 86400_000), limit: 50 }); expect(objects.size).toBe(0);
});
it("shows both account IDs and video usage only to admins without private metadata", async () => {
  const u = await start(32); await act(u.parts[0]); await act({ action: "finish", id: u.id });
  await expect(asUser(owner, () => adminCoupleStorage(couple, 0, 25))).rejects.toThrow();
  await prisma.adminAccess.create({ data: { userId: owner } });
  const result = await asUser(owner, () => adminCoupleStorage(partner, 0, 25));
  expect(result.rows).toHaveLength(1); expect(result.rows[0]).toMatchObject({ id: couple, totalBytes: 32, videoBytes: 32 });
  expect(result.rows[0].members.map((m) => m.userId).sort()).toEqual([owner, partner].sort());
  expect(JSON.stringify(result)).not.toMatch(/private-video|@example.invalid|Video QA/);
});
