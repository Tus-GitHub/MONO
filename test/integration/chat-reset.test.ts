import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"), { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const mailbox = vi.hoisted(() => ({ messages: [] as { to: string; text: string; html: string }[], fail: false }));
const background = vi.hoisted(() => [] as (() => Promise<unknown>)[]);
vi.mock("next/server", async importOriginal => ({ ...await importOriginal<typeof import("next/server")>(), after: (callback: () => Promise<unknown>) => { background.push(callback); } }));
const objects = vi.hoisted(() => ({ values: new Map<string, Buffer>(), removed: [] as string[], failDelete: false, beforePut: undefined as undefined | (() => Promise<void>) }));
vi.mock("@/lib/storage", () => ({ storage: {
  put: async ({ key, body }: { key: string; body: Buffer }) => { await objects.beforePut?.(); objects.values.set(key, Buffer.from(body)); },
  get: async (key: string) => { const bytes = objects.values.get(key); if (!bytes) throw new Error("Missing object"); return bytes; },
  delete: async (key: string) => { if (objects.failDelete) throw new Error("Synthetic storage outage"); objects.values.delete(key); objects.removed.push(key); },
  publicUrl: (key: string) => `/media/${key}`,
} }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async (message: typeof mailbox.messages[number]) => {
  mailbox.messages.push(message); if (mailbox.fail && mailbox.messages.length % 2 === 0) throw new Error("Synthetic SMTP failure");
}) }));
import { prisma } from "@/lib/db/prisma";
import { env } from "@/config/env";
import { actOnChatReset } from "@/server/services/chat-reset-service";
import { cleanResetChatFiles } from "@/server/services/chat-reset-cleanup-service";
import { processStorageCleanup } from "@/server/services/storage-cleanup-service";
import { actOnGame, sendChatMessage, togetherSnapshot } from "@/server/services/together-service";
import { changeChatMessage, legacyChatPage, readChatImage, registerChatKey, sendEncryptedImage } from "@/server/services/chat-security-service";
import { getSavedPhotoCrop, savePhotoCrop } from "@/server/services/photo-crop-service";
import { listChatStickers, sendEncryptedSticker } from "@/server/services/chat-sticker-service";
import { sendEncryptedDocument } from "@/server/services/chat-document-service";
import { actOnChatVideo, readChatVideo } from "@/server/services/chat-video-service";
import { chatAAD, encryptBytes, encryptText, decryptText, newRecoveryCode, recoverChatKey, type ChatKey } from "@/lib/together/chat-crypto";
import { encryptSticker } from "@/lib/together/stickers";
import { videoChunkAAD } from "@/lib/together/video-policy";
import { POST } from "@/app/api/together/encryption/reset/route";
let owner: string, partner: string, outsider: string, otherPartner: string, couple: string, otherCouple: string, key: ChatKey, next: ChatKey;
beforeEach(async () => {
  mailbox.messages = []; mailbox.fail = false;
  background.length = 0;
  objects.values.clear(); objects.removed = []; objects.failDelete = false; objects.beforePut = undefined;
  async function pair() {
    const nonce = randomUUID();
    const a = await prisma.user.create({ data: { name: "Reset tester", email: `a-${nonce}@example.invalid`, emailVerified: new Date(), avatarUrl: "/kept-avatar" } });
    const b = await prisma.user.create({ data: { name: "Reset partner", email: `b-${nonce}@example.invalid`, emailVerified: new Date() } });
    const c = await prisma.couple.create({ data: { createdById: a.id, inviteCode: nonce, status: "ACTIVE", photoUrl: "/kept-cover", members: { create: [{ userId: a.id, role: "OWNER", status: "ACTIVE" }, { userId: b.id, role: "PARTNER", status: "ACTIVE" }] } } });
    return [a.id, b.id, c.id];
  }
  [owner, partner, couple] = await pair(); [outsider, otherPartner, otherCouple] = await pair();
  key = await recoverChatKey(newRecoveryCode(), couple); next = await recoverChatKey(newRecoveryCode(), couple);
  await asUser(owner, () => registerChatKey(key.id));
  const nonce = randomUUID();
  await asUser(owner, async () => sendChatMessage({ kind: "TEXT", clientNonce: nonce, body: await encryptText(key, "Before any reset", chatAAD(couple, owner, nonce, "TEXT")) }));
});
afterEach(async () => {
  await prisma.storageCleanup.deleteMany({ where: { OR: [couple, otherCouple].map(id => ({ key: { startsWith: `couples/${id}/` } })) } });
  await prisma.soloGameScore.deleteMany({ where: { coupleId: couple } });
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider, otherPartner] } } });
});
afterAll(() => prisma.$disconnect());
async function request() {
  const result = await asUser(owner, () => actOnChatReset({ action: "request", keyId: next.id, deleteOldChat: true }));
  if (!("requestId" in result)) throw new Error("Missing delivery");
  const codes = mailbox.messages.slice(-2).map(message => message.text.match(/Your chat reset code:\s*(\d{6})/)![1]);
  return { delivery: result, confirm: { action: "confirm", requestId: result.requestId, ownCode: codes[0], partnerCode: codes[1], acknowledged: true, deleteOldChat: true } };
}
const unchanged = async () => {
  expect(await prisma.couple.findUniqueOrThrow({ where: { id: couple } })).toMatchObject({ chatKeyId: key.id, chatGeneration: 0 });
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBeGreaterThan(0);
};
const confirm = (payload: unknown, user = owner) => asUser(user, () => actOnChatReset(payload));
const ageRequest = () => prisma.chatResetRequest.update({ where: { coupleId: couple }, data: { requestedAt: new Date(Date.now() - 61_000) } });
it("needs two distinct codes in one submission; stores only bound hashes and consumes the pair once", async () => {
  const r = await request();
  expect(r.confirm.ownCode).not.toBe(r.confirm.partnerCode);
  expect(r.delivery.ownEmail).toContain("•••"); expect(mailbox.messages).toHaveLength(2);
  const record = await prisma.chatResetRequest.findUniqueOrThrow({ where: { coupleId: couple } });
  expect(record.requesterOtpHash).toMatch(/^[a-f0-9]{64}$/); expect(record.partnerOtpHash).toMatch(/^[a-f0-9]{64}$/);
  await unchanged();
  await expect(confirm({ ...r.confirm, partnerCode: "" })).rejects.toThrow();
  await expect(confirm({ ...r.confirm, partnerCode: r.confirm.ownCode })).rejects.toThrow("Both codes");
  expect((await prisma.chatResetRequest.findUniqueOrThrow({ where: { coupleId: couple } })).attempts).toBe(1);
  await unchanged();
  const results = await Promise.allSettled([confirm(r.confirm), confirm(r.confirm)]);
  expect(results.filter(value => value.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.couple.findUniqueOrThrow({ where: { id: couple } })).toMatchObject({ chatKeyId: next.id, chatGeneration: 1 });
  await expect(confirm(r.confirm)).rejects.toThrow();
});
it("permanently deletes only previous chat and media, lets both partners chat again, and preserves everything else", async () => {
  const nonce = randomUUID(), aad = (kind: string) => chatAAD(couple, owner, nonce, kind);
  const body = await encryptText(key, "old secret", aad("TEXT"));
  const text = await asUser(owner, () => sendChatMessage({ kind: "TEXT", clientNonce: nonce, body }));
  const photoNonce = randomUUID(), bytes = new TextEncoder().encode("old encrypted media");
  const image = await asUser(owner, async () => sendEncryptedImage({ ...await encryptBytes(key, bytes, chatAAD(couple, owner, photoNonce, "IMAGE_BYTES:0")), keyId: key.id, clientNonce: photoNonce, width: 1, height: 1, viewLimit: 0 }));
  const crop = await asUser(owner, () => getSavedPhotoCrop({ kind: "chat", id: image.id }));
  const sticker = await asUser(owner, async () => sendEncryptedSticker(await encryptSticker({ id: randomUUID(), bytes, width: 64, height: 64 }, "Private sticker", key, couple, owner, randomUUID())));
  const docNonce = randomUUID();
  const document = await asUser(owner, async () => sendEncryptedDocument({ ...await encryptBytes(key, bytes, chatAAD(couple, owner, docNonce, "DOCUMENT_BYTES")), keyId: key.id, clientNonce: docNonce, body: await encryptText(key, "private document", chatAAD(couple, owner, docNonce, "DOCUMENT")) }));
  const date = await prisma.date.create({ data: { coupleId: couple, createdById: owner, title: "Café then movie", status: "COMPLETED", expectedBudgetCents: 250000 } });
  const photo = await prisma.datePhoto.create({ data: { dateId: date.id, uploadedById: owner, storageKey: "kept-date-photo", url: "/kept-date-photo", width: 100, height: 100 } });
  const memory = await prisma.memory.create({ data: { coupleId: couple, dateId: date.id, authorId: owner, title: "Our evening", body: "Keep this", coverPhotoId: photo.id } });
  const expense = await prisma.expense.create({ data: { coupleId: couple, dateId: date.id, recordedById: owner, description: "Dinner", amountCents: 120000 } });
  const score = await prisma.soloGameScore.create({ data: { coupleId: couple, userId: owner, kind: "EMOJI_BOUNCE", bestScore: 85 } });
  const game = await asUser(owner, () => actOnGame({ action: "create", kind: "TIC_TAC_TOE", clientNonce: randomUUID() }));
  const users = await prisma.user.findMany({ where: { id: { in: [owner, partner] } }, orderBy: { id: "asc" } });
  const foreign = await prisma.chatMessage.create({ data: { coupleId: otherCouple, senderId: outsider, clientNonce: randomUUID(), kind: "TEXT", body: "Other couple history" } });
  const gameBefore = await prisma.gameMatch.findUniqueOrThrow({ where: { id: game.id } });
  const before = await asUser(partner, togetherSnapshot), r = await request(); await confirm(r.confirm);
  for (const user of [owner, partner]) {
    const current = await asUser(user, togetherSnapshot);
    expect(current.messages).toEqual([]); expect(current.chatKeyId).toBe(next.id);
    expect(current.games?.map(value => value.id)).toContain(game.id); expect(current.soloScores).toContainEqual({ kind: score.kind, userId: owner, bestScore: 85 });
    expect((await asUser(user, () => togetherSnapshot({ before: BigInt(before.cursor) + BigInt(1) }))).messages).toEqual([]);
    expect((await asUser(user, () => togetherSnapshot({ after: BigInt(before.cursor), revision: "0" }))).updates).toEqual([]);
    expect(await asUser(user, legacyChatPage)).toEqual([]); expect(await asUser(user, listChatStickers)).toEqual([]);
    for (const id of [image.id, sticker.id, document.id]) await expect(asUser(user, () => readChatImage(id, false))).rejects.toThrow();
  }
  await expect(asUser(owner, () => getSavedPhotoCrop({ kind: "chat", id: image.id }))).rejects.toThrow();
  await expect(asUser(owner, () => savePhotoCrop({ target: { kind: "chat", id: image.id }, revision: crop.revision, crop: null }))).rejects.toThrow();
  await expect(asUser(owner, () => changeChatMessage({ action: "delete-everyone", id: text.id }))).rejects.toThrow();
  await expect(asUser(owner, () => sendChatMessage({ kind: "TEXT", clientNonce: nonce, body }))).rejects.toThrow();
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(0);
  expect(await prisma.chatImage.count({ where: { coupleId: couple } })).toBe(0);
  expect(await prisma.chatMessage.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
  expect(await prisma.gameMatch.findUnique({ where: { id: game.id } })).toEqual(gameBefore);
  expect(await prisma.user.findMany({ where: { id: { in: [owner, partner] } }, orderBy: { id: "asc" } })).toEqual(users);
  expect(await prisma.date.findUnique({ where: { id: date.id } })).toEqual(date);
  expect(await prisma.datePhoto.findUnique({ where: { id: photo.id } })).toEqual(photo);
  expect(await prisma.memory.findUnique({ where: { id: memory.id } })).toEqual(memory);
  expect(await prisma.expense.findUnique({ where: { id: expense.id } })).toEqual(expense);
  expect(await prisma.soloGameScore.findUnique({ where: { coupleId_userId_kind: { coupleId: couple, userId: owner, kind: score.kind } } })).toEqual(score);
  expect(await prisma.couple.findUniqueOrThrow({ where: { id: couple } })).toMatchObject({ photoUrl: "/kept-cover", status: "ACTIVE" });
  for (const sender of [owner, partner]) {
    const freshNonce = randomUUID(), freshAAD = chatAAD(couple, sender, freshNonce, "TEXT");
    const row = await asUser(sender, async () => sendChatMessage({ kind: "TEXT", clientNonce: freshNonce, body: await encryptText(next, "fresh chat", freshAAD) }));
    expect(row.generation).toBe(1); expect(await decryptText(next, row.body, freshAAD)).toBe("fresh chat");
    await expect(decryptText(key, row.body, freshAAD)).rejects.toThrow();
  }
  expect((await asUser(partner, togetherSnapshot)).messages).toHaveLength(2);
});
it("persists five failed pair attempts and never accepts a correct pair afterward", async () => {
  const r = await request();
  for (let attempt = 0; attempt < 5; attempt++) await expect(confirm({ ...r.confirm, ownCode: r.confirm.partnerCode, partnerCode: r.confirm.ownCode })).rejects.toThrow();
  expect((await prisma.chatResetRequest.findUniqueOrThrow({ where: { coupleId: couple } })).attempts).toBe(5);
  await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
});
it("blocks old video reads and finishing an old upload after the reset", async () => {
  const clientNonce = randomUUID(), body = await encryptText(key, "private video", chatAAD(couple, owner, clientNonce, "VIDEO"));
  const upload = await asUser(owner, () => actOnChatVideo({ action: "start", keyId: key.id, clientNonce, body, byteLength: 32 })) as { id: string };
  const message = await prisma.chatMessage.create({ data: { coupleId: couple, senderId: owner, clientNonce, kind: "VIDEO", encrypted: true, body } });
  await prisma.chatVideo.update({ where: { id: upload.id }, data: { messageId: message.id } });
  expect(await asUser(partner, () => readChatVideo(message.id))).toMatchObject({ byteLength: 32 });
  const r = await request(); await confirm(r.confirm);
  for (const user of [owner, partner]) await expect(asUser(user, () => readChatVideo(message.id))).rejects.toThrow();
  await expect(asUser(owner, () => actOnChatVideo({ action: "finish", id: upload.id }))).rejects.toThrow();
  expect(await prisma.chatVideo.count({ where: { id: upload.id } })).toBe(0);
});
it("rejects expiry, cancelled requests, foreign users and the partner submitting the owner's request", async () => {
  const r = await request();
  await expect(confirm(r.confirm, outsider)).rejects.toThrow(); await expect(confirm(r.confirm, partner)).rejects.toThrow();
  await prisma.chatResetRequest.update({ where: { coupleId: couple }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
  await ageRequest(); const again = await request();
  await confirm({ action: "cancel", requestId: again.confirm.requestId });
  await expect(confirm(again.confirm)).rejects.toThrow(); await unchanged();
});
it("requires current verified mailboxes and invalidates codes when an email changes", async () => {
  const r = await request();
  await prisma.user.update({ where: { id: partner }, data: { email: `changed-${randomUUID()}@example.invalid` } });
  await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
  await ageRequest(); await prisma.user.update({ where: { id: partner }, data: { emailVerified: null } });
  await expect(request()).rejects.toThrow("verified");
});
it("blocks approval if a partner leaves or is blocked", async () => {
  const r = await request();
  await prisma.user.update({ where: { id: partner }, data: { blockedAt: new Date() } });
  await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
  await prisma.user.update({ where: { id: partner }, data: { blockedAt: null } });
  await prisma.coupleMember.updateMany({ where: { coupleId: couple, userId: partner }, data: { status: "LEFT" } });
  await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
});
it("shares cooldown and hourly limits between both partners and supersedes old codes", async () => {
  const first = await request();
  await expect(asUser(partner, () => actOnChatReset({ action: "request", keyId: next.id, deleteOldChat: true }))).rejects.toThrow("one minute");
  await ageRequest(); const second = await request();
  await expect(confirm(first.confirm)).rejects.toThrow();
  await expect(confirm({ ...second.confirm, ownCode: first.confirm.ownCode, partnerCode: first.confirm.partnerCode })).rejects.toThrow();
  await ageRequest(); await request(); await ageRequest();
  await expect(asUser(partner, () => actOnChatReset({ action: "request", keyId: next.id, deleteOldChat: true }))).rejects.toThrow("Three reset");
  await unchanged();
});
it("does not enable either code if one email fails", async () => {
  mailbox.fail = true; await expect(request()).rejects.toThrow("Could not send both emails");
  const record = await prisma.chatResetRequest.findUniqueOrThrow({ where: { coupleId: couple } });
  expect(record.sentAt).toBeNull();
  const codes = mailbox.messages.map(message => message.text.match(/Your chat reset code:\s*(\d{6})/)![1]);
  await expect(confirm({ action: "confirm", requestId: record.requestId, ownCode: codes[0], partnerCode: codes[1], acknowledged: true, deleteOldChat: true })).rejects.toThrow();
  await unchanged();
});
it("rejects reuse of the active key and cross-origin requests without sending mail", async () => {
  await expect(asUser(owner, () => actOnChatReset({ action: "request", keyId: key.id, deleteOldChat: true }))).rejects.toThrow("new recovery code");
  const response = await asUser(owner, () => POST(new Request("http://localhost:3000/api/together/encryption/reset", { method: "POST", headers: { origin: "https://foreign.invalid", "content-type": "application/json" }, body: JSON.stringify({ action: "request", keyId: next.id }) })));
  expect(response.status).toBe(403); expect(mailbox.messages).toEqual([]); await unchanged();
});
it("requires explicit deletion consent and refuses OTPs issued under the older retention policy", async () => {
  await expect(asUser(owner, () => actOnChatReset({ action: "request", keyId: next.id }))).rejects.toThrow();
  expect(mailbox.messages).toHaveLength(0);
  const r = await request();
  await expect(confirm({ ...r.confirm, deleteOldChat: undefined })).rejects.toThrow();
  await expect(confirm({ ...r.confirm, deleteOldChat: false })).rejects.toThrow();
  await expect(confirm({ ...r.confirm, acknowledged: false })).rejects.toThrow();
  const ownUser = await prisma.user.findUniqueOrThrow({ where: { id: owner } }), partnerUser = await prisma.user.findUniqueOrThrow({ where: { id: partner } });
  const oldDigest = (...parts: string[]) => createHmac("sha256", env.AUTH_SECRET).update(JSON.stringify(["amor-chat-reset-v1", ...parts])).digest("hex");
  await prisma.chatResetRequest.update({ where: { coupleId: couple }, data: {
    requesterEmailHash: oldDigest("mailbox", ownUser.email), partnerEmailHash: oldDigest("mailbox", partnerUser.email),
    requesterOtpHash: oldDigest(r.confirm.requestId, owner, next.id, r.confirm.ownCode), partnerOtpHash: oldDigest(r.confirm.requestId, partner, next.id, r.confirm.partnerCode),
  } });
  await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
});
async function video() {
  const nonce = randomUUID(), body = await encryptText(key, "private video", chatAAD(couple, owner, nonce, "VIDEO"));
  const upload = await asUser(owner, () => actOnChatVideo({ action: "start", keyId: key.id, clientNonce: nonce, body, byteLength: 32 })) as { id: string };
  const encrypted = await encryptBytes(key, new Uint8Array(32), chatAAD(couple, owner, nonce, videoChunkAAD(0, 1)));
  return { id: upload.id, part: { action: "part", id: upload.id, index: 0, ...encrypted } };
}
it("deletes sent and unfinished videos and retries physical deletion without touching other files", async () => {
  const sent = await video(), staged = await video();
  await asUser(owner, () => actOnChatVideo(sent.part)); await asUser(owner, () => actOnChatVideo({ action: "finish", id: sent.id }));
  await asUser(owner, () => actOnChatVideo(staged.part));
  const oldKeys = [...objects.values.keys()];
  const unrelated = `couples/${otherCouple}/chat-videos/other/part.bin`, dateKey = `couples/${couple}/dates/safe/photo.webp`;
  objects.values.set(unrelated, Buffer.from("Other couple")); objects.values.set(dateKey, Buffer.from("Date photo"));
  await prisma.storageCleanup.createMany({ data: [unrelated, dateKey].map(key => ({ key, nextAttemptAt: new Date(0) })) });
  const otherJobs = await prisma.storageCleanup.findMany({ where: { key: { in: [unrelated, dateKey] } }, orderBy: { key: "asc" } });
  const r = await request(); await confirm(r.confirm);
  expect(await prisma.chatVideo.count({ where: { coupleId: couple } })).toBe(0);
  expect(await prisma.chatVideoPart.count({ where: { videoId: { in: [sent.id, staged.id] } } })).toBe(0);
  objects.failDelete = true; await cleanResetChatFiles(couple);
  expect(oldKeys.every(key => objects.values.has(key))).toBe(true);
  const failed = await prisma.storageCleanup.findMany({ where: { key: { in: oldKeys } } });
  expect(failed).toHaveLength(2); expect(failed.every(job => job.attempts === 1 && job.lastError === "cleanup_failed")).toBe(true);
  objects.failDelete = false;
  await processStorageCleanup({ now: new Date(Date.now() + 120_000), keyPrefix: `couples/${couple}/`, chatVideosOnly: true, limit: 50 });
  expect(oldKeys.some(key => objects.values.has(key))).toBe(false);
  expect(objects.values.has(unrelated)).toBe(true); expect(objects.values.has(dateKey)).toBe(true);
  expect(await prisma.storageCleanup.findMany({ where: { key: { in: [unrelated, dateKey] } }, orderBy: { key: "asc" } })).toEqual(otherJobs);
});
it("requeues an object that finishes uploading after reset cleanup has already run", async () => {
  const upload = await video(), r = await request();
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const hold = new Promise<void>(resolve => { release = resolve; });
  objects.beforePut = async () => { entered(); await hold; };
  const outcome = asUser(owner, () => actOnChatVideo(upload.part)).then(() => "unexpected success", () => "rejected");
  await started; await confirm(r.confirm); await cleanResetChatFiles(couple);
  expect(await prisma.storageCleanup.count({ where: { key: { startsWith: `couples/${couple}/chat-videos/` } } })).toBe(0);
  release(); expect(await outcome).toBe("rejected");
  expect(objects.values.size).toBe(1);
  expect(await prisma.storageCleanup.count({ where: { key: { startsWith: `couples/${couple}/chat-videos/` } } })).toBe(1);
  await cleanResetChatFiles(couple); expect(objects.values.size).toBe(0);
});
it("rolls back deletion and the new key together when database deletion fails", async () => {
  const upload = await video(); await asUser(owner, () => actOnChatVideo(upload.part));
  const r = await request();
  await prisma.$executeRawUnsafe("CREATE FUNCTION mono_test_block_chat_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic deletion failure'; END; $$");
  try {
    await prisma.$executeRawUnsafe("CREATE TRIGGER mono_test_chat_delete_failure BEFORE DELETE ON chat_messages FOR EACH STATEMENT EXECUTE FUNCTION mono_test_block_chat_delete()");
    try {
      await expect(confirm(r.confirm)).rejects.toThrow(); await unchanged();
      expect(await prisma.chatVideo.count({ where: { id: upload.id } })).toBe(1);
      expect((await prisma.chatResetRequest.findUniqueOrThrow({ where: { coupleId: couple } })).usedAt).toBeNull();
    } finally { await prisma.$executeRawUnsafe("DROP TRIGGER mono_test_chat_delete_failure ON chat_messages"); }
  } finally { await prisma.$executeRawUnsafe("DROP FUNCTION mono_test_block_chat_delete()"); }
  await confirm(r.confirm); expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(0);
});
it("also deletes retained earlier generations and schedules scoped cleanup only after API approval", async () => {
  await prisma.couple.update({ where: { id: couple }, data: { chatGeneration: 1 } });
  await prisma.chatMessage.create({ data: { coupleId: couple, senderId: partner, generation: 1, clientNonce: randomUUID(), kind: "TEXT", encrypted: true, body: "Previous-generation ciphertext" } });
  const upload = await video(); await asUser(owner, () => actOnChatVideo(upload.part));
  const r = await request();
  const post = (body: unknown) => asUser(owner, () => POST(new Request("http://localhost:3000/api/together/encryption/reset", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) })));
  expect((await post({ ...r.confirm, partnerCode: r.confirm.ownCode })).status).toBe(422);
  expect(background).toHaveLength(0); expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(2);
  const response = await post(r.confirm); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ reset: true, keyId: next.id });
  expect(background).toHaveLength(1); expect(objects.values.size).toBe(1);
  await background[0](); expect(objects.values.size).toBe(0);
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(0);
  expect((await prisma.couple.findUniqueOrThrow({ where: { id: couple } })).chatGeneration).toBe(2);
  expect((await post(r.confirm)).status).toBe(422); expect(background).toHaveLength(1);
});
