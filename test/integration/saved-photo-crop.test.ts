import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"); const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { saveUserAvatar, saveCoupleCover } from "@/server/services/profile-media-service";
import { getSavedPhotoCrop, savePhotoCrop } from "@/server/services/photo-crop-service";
import { togetherSnapshot } from "@/server/services/together-service";
import { readChatImage, registerChatKey, sendEncryptedImage } from "@/server/services/chat-security-service";
import { chatAAD, encryptBytes, newRecoveryCode, recoverChatKey } from "@/lib/together/chat-crypto";
import { GET as getMedia } from "@/app/media/[...key]/route";
import { PATCH } from "@/app/api/photos/crop/route";

let owner: string, partner: string, outsider: string, couple: string, otherCouple: string, dateId: string, bytes: Buffer;
const keys: string[] = [], crop = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
beforeAll(async () => {
  const run = randomUUID();
  [owner, partner, outsider] = await Promise.all([0, 1, 2].map(async (i) => (await prisma.user.create({ data: { name: `saved-crop-${run}-${i}`, email: `saved-crop-${run}-${i}@example.invalid`, emailVerified: new Date() } })).id));
  couple = (await prisma.couple.create({ data: { createdById: owner, inviteCode: run, status: "ACTIVE", members: { create: [{ userId: owner, role: "OWNER" }, { userId: partner, role: "PARTNER" }] } } })).id;
  otherCouple = (await prisma.couple.create({ data: { createdById: outsider, inviteCode: `${run}-other`, members: { create: { userId: outsider, role: "OWNER" } } } })).id;
  dateId = (await prisma.date.create({ data: { title: "Retained photo references", coupleId: couple, createdById: owner, status: "COMPLETED" } })).id;
  bytes = await sharp({ create: { width: 120, height: 80, channels: 3, background: "red" } }).webp().toBuffer();
});
afterAll(async () => {
  for (const key of keys) await storage.delete(key);
  await prisma.storageCleanup.deleteMany({ where: { key: { in: keys } } });
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider] } } });
  await prisma.$disconnect();
});
const file = () => ({ filename: "source.webp", contentType: "image/webp", bytes });
const descriptor = (user: string, kind: "avatar" | "couple" | "date" | "chat", id?: string) => asUser(user, () => getSavedPhotoCrop({ kind, ...(id ? { id } : {}) }));

it("adjusts profile and couple framing without storage writes, protects newer edits and resets on replacement", async () => {
  const avatar = await asUser(owner, () => saveUserAvatar(file())); keys.push(avatar.key!);
  const cover = await asUser(owner, () => saveCoupleCover(file())); keys.push(cover.key!);
  const put = vi.spyOn(storage, "put");
  for (const kind of ["avatar", "couple"] as const) {
    const before = await descriptor(owner, kind);
    const coupleBefore = await prisma.couple.findUniqueOrThrow({ where: { id: couple } });
    const result = await asUser(owner, () => savePhotoCrop({ target: { kind }, revision: before.revision, crop }));
    expect(result).toHaveProperty("url", expect.stringContaining("?crop="));
    const after = await descriptor(kind === "couple" ? partner : owner, kind);
    expect(after.sourceUrl).toBe(before.sourceUrl); expect(after.crop).toEqual(crop);
    expect(after.revision).not.toBe(before.revision);
    expect((await prisma.couple.findUniqueOrThrow({ where: { id: couple } })).updatedAt.getTime()).toBeGreaterThan(coupleBefore.updatedAt.getTime());
    await expect(asUser(owner, () => savePhotoCrop({ target: { kind }, revision: before.revision, crop: null }))).rejects.toThrow(/changed/);
    await asUser(owner, () => savePhotoCrop({ target: { kind }, revision: after.revision, crop: null }));
    expect((await descriptor(owner, kind)).sourceUrl).toBe(before.sourceUrl);
  }
  expect(put).not.toHaveBeenCalled(); put.mockRestore();
  const before = await descriptor(owner, "avatar");
  const replacement = await asUser(owner, () => saveUserAvatar(file())); keys.push(replacement.key!);
  await expect(asUser(owner, () => savePhotoCrop({ target: { kind: "avatar" }, revision: before.revision, crop }))).rejects.toThrow(/changed/);
  expect((await descriptor(owner, "avatar")).crop).toBeNull();
});

it("keeps date identity, captions, favorites and Memory references while both partners can adjust it", async () => {
  const key = `couples/${couple}/dates/${dateId}/${randomUUID()}.webp`; keys.push(key);
  await storage.put({ key, body: bytes, contentType: "image/webp" });
  const photo = await prisma.datePhoto.create({ data: { dateId, uploadedById: owner, storageKey: key, url: storage.publicUrl(key), width: 120, height: 80, caption: "Our evening", isFavorite: true, sortOrder: 7 } });
  await prisma.date.update({ where: { id: dateId }, data: { bestPhotoId: photo.id } });
  const memory = await prisma.memory.create({ data: { coupleId: couple, authorId: owner, dateId, title: "Our evening", body: "Keep it", coverPhotoId: photo.id } });
  const before = await descriptor(owner, "date", photo.id);
  const result = await asUser(partner, () => savePhotoCrop({ target: { kind: "date", id: photo.id }, revision: before.revision, crop }));
  expect(result).toMatchObject({ photo: { id: photo.id, width: 60, height: 40, caption: "Our evening", isFavorite: true, isBest: true } });
  const stored = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  expect(stored).toMatchObject({ storageKey: key, width: 120, height: 80, sortOrder: 7, crop });
  expect(await storage.get(key)).toEqual(bytes);
  expect((await prisma.memory.findUniqueOrThrow({ where: { id: memory.id } })).coverPhotoId).toBe(photo.id);
  await expect(descriptor(outsider, "date", photo.id)).rejects.toThrow();
  await expect(asUser(outsider, () => savePhotoCrop({ target: { kind: "date", id: photo.id }, revision: before.revision, crop }))).rejects.toThrow();
  const concurrent = await descriptor(owner, "date", photo.id);
  const attempts = await Promise.allSettled([owner, partner].map(user => asUser(user, () => savePhotoCrop({ target: { kind: "date", id: photo.id }, revision: concurrent.revision, crop: { ...crop, x: 0.1 } }))));
  expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
});

it("serves matching private cropped pixels, invalidates cache framing and rejects unauthorized cached access", async () => {
  const info = await descriptor(owner, "avatar"), key = info.sourceUrl.slice("/media/".length);
  const request = (user: string, suffix: string, etag?: string) => asUser(user, () => getMedia(new NextRequest(`http://localhost/media/${key}${suffix}`, { headers: etag ? { "if-none-match": etag } : {} }), { params: Promise.resolve({ key: key.split("/") }) }));
  const whole = await request(partner, ""), adjusted = await request(partner, "?crop=0.25,0.25,0.5,0.5", whole.headers.get("etag")!);
  expect(adjusted.status).toBe(200); expect(adjusted.headers.get("etag")).not.toBe(whole.headers.get("etag"));
  expect(await sharp(Buffer.from(await adjusted.arrayBuffer())).metadata()).toMatchObject({ width: 60, height: 40 });
  expect((await request(outsider, "?crop=0.25,0.25,0.5,0.5", adjusted.headers.get("etag")!)).status).toBe(404);
  expect((await request(owner, "?crop=0,0,2,1")).status).toBe(400);
  const blocked = await asUser(owner, () => PATCH(new Request("http://localhost:3000/api/photos/crop", { method: "PATCH", headers: { origin: "https://foreign.invalid", "content-type": "application/json" }, body: "{}" })));
  expect(blocked.status).toBe(403);
});

it("changes only encrypted chat crop metadata, preserves private views, and sends edits to the partner below the message cursor", async () => {
  const key = await recoverChatKey(newRecoveryCode(), couple); await asUser(owner, () => registerChatKey(key.id));
  const clientNonce = randomUUID();
  const row = await asUser(owner, async () => sendEncryptedImage({ ...await encryptBytes(key, bytes, chatAAD(couple, owner, clientNonce, "IMAGE_BYTES:2")), keyId: key.id, clientNonce, width: 120, height: 80, viewLimit: 2 }));
  await asUser(partner, () => readChatImage(row.id, true));
  const before = await prisma.chatImage.findUniqueOrThrow({ where: { messageId: row.id } });
  const snapshot = await asUser(partner, () => togetherSnapshot()), info = await descriptor(owner, "chat", row.id);
  await asUser(owner, () => readChatImage(row.id, true)); // Opening the sender's crop editor consumes no recipient view.
  await asUser(owner, () => savePhotoCrop({ target: { kind: "chat", id: row.id }, revision: info.revision, crop }));
  const after = await prisma.chatImage.findUniqueOrThrow({ where: { messageId: row.id } });
  expect(after).toMatchObject({ crop, viewsUsed: 1, viewLimit: 2, iv: before.iv, encrypted: true, byteLength: before.byteLength });
  expect(after.bytes).toEqual(before.bytes);
  const updates = await asUser(partner, () => togetherSnapshot({ after: BigInt(snapshot.cursor), revision: snapshot.revision }));
  expect(updates.messages).toEqual([]); expect(updates.updates).toEqual(expect.arrayContaining([expect.objectContaining({ id: row.id, image: expect.objectContaining({ crop }) })]));
  await expect(descriptor(partner, "chat", row.id)).rejects.toThrow();
  await expect(asUser(partner, () => savePhotoCrop({ target: { kind: "chat", id: row.id }, revision: info.revision, crop: null }))).rejects.toThrow();
  await expect(asUser(owner, () => savePhotoCrop({ target: { kind: "chat", id: row.id }, revision: info.revision, crop: null }))).rejects.toThrow(/changed/);
});
