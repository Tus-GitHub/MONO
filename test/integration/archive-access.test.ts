import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterEach, afterAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"), { testUser } = await import("./auth-context"), { AuthenticationError } = await import("@/lib/errors");
  return { requireUser: async () => { const id = testUser.getStore(); const user = id && await prisma.user.findFirst({ where: { id, deletedAt: null, blockedAt: null } }); if (!user) throw new AuthenticationError(); return user; } };
});
import { prisma } from "@/lib/db/prisma";
import { deleteAccount } from "@/server/services/account-service";
import { authenticate, registerUser } from "@/server/services/auth-service";
import { upsertUserFromOAuthProfile } from "@/lib/auth/oauth/google";
import { hashPassword } from "@/lib/auth/password";
import { createAuthSession, resolveSessionUser } from "@/lib/auth/session-store";
import { requestArchivedAccess, reviewArchiveAccess, listArchiveAccessRequests, listMyArchivedSpaces } from "@/server/services/archive-access-service";
import { requireArchivedRead } from "@/lib/authz/archived-space";
import { getArchivedSpace, archivedDate, archivedDates, archivedChat, archivedMemories, archivedPhotos, archivedExpenses, archivedPlaces, readArchivedImage, readArchivedVideo } from "@/server/services/archived-content-service";
import { requireTogether } from "@/server/services/together-context";
import { createDate } from "@/server/services/date-service";
import { storage } from "@/lib/storage";
import { GET as mediaGET } from "@/app/media/[...key]/route";
import { processStorageCleanup, queueStorageCleanup } from "@/server/services/storage-cleanup-service";
import { getUnreadNotificationCount, listNotifications } from "@/server/services/notification-service";

let users: string[], coupleId: string, dateId: string, messageId: string, avatar: string, photoKey: string, email: string, run: string, passwordHash: string;
const password = "ArchiveQA@123";
const close = () => asUser(users[0], () => deleteAccount(users[0]));
const request = () => asUser(users[1], () => requestArchivedAccess(coupleId));
const grant = async (action: "APPROVED" | "DENIED" | "REVOKED" = "APPROVED") => {
  const row = await prisma.archiveAccessRequest.findUniqueOrThrow({ where: { coupleId_requesterId: { coupleId, requesterId: users[1] } } });
  await asUser(users[2], () => reviewArchiveAccess({ requestId: row.id, action })); return row.id;
};
const readMedia = (key: string) => mediaGET(new NextRequest(`http://localhost/media/${key}`), { params: Promise.resolve({ key: key.split("/") }) });
beforeAll(async () => { passwordHash = await hashPassword(password); });
beforeEach(async () => {
  run = randomUUID(); users = [];
  for (let index = 0; index < 4; index++) users.push((await prisma.user.create({ data: { name: "Same name", email: `archive-${run}-${index}@example.invalid`, emailVerified: new Date(), profileCompletedAt: new Date(), passwordHash } })).id);
  email = `archive-${run}-0@example.invalid`;
  await prisma.adminAccess.create({ data: { userId: users[2] } });
  coupleId = (await prisma.couple.create({ data: { name: "Retained shared space", status: "ACTIVE", inviteCode: run, createdById: users[0], setupCompletedAt: new Date(), chatKeyId: "existing-key",
    members: { create: [{ userId: users[0], role: "OWNER" }, { userId: users[1], role: "PARTNER" }] } } })).id;
  dateId = (await prisma.date.create({ data: { title: "Cafe then movie", coupleId, createdById: users[0], activities: { create: [{ title: "Cafe", sortOrder: 0 }, { title: "Movie", sortOrder: 1 }] } } })).id;
  await prisma.memory.create({ data: { coupleId, dateId, authorId: users[0], title: "A memory", body: "Kept text" } });
  await prisma.expense.create({ data: { coupleId, dateId, recordedById: users[0], description: "Cafe", amountCents: 30000 } });
  await prisma.place.create({ data: { coupleId, createdById: users[0], name: "Saved cafe", category: "CAFE" } });
  messageId = (await prisma.chatMessage.create({ data: { coupleId, senderId: users[0], clientNonce: run, kind: "TEXT", body: "Client-encrypted ciphertext", encrypted: true } })).id;
  avatar = `users/${users[0]}/avatar/retained.webp`; photoKey = `couples/${coupleId}/dates/${dateId}/photos/retained.webp`;
  await prisma.user.update({ where: { id: users[0] }, data: { avatarKey: avatar, avatarUrl: storage.publicUrl(avatar), avatarCrop: { x: 0, y: 0, width: 1, height: 1 } } });
  await prisma.datePhoto.create({ data: { dateId, uploadedById: users[0], storageKey: photoKey, url: storage.publicUrl(photoKey) } });
  await storage.put({ key: avatar, body: Buffer.from("retained-avatar") });
  await storage.put({ key: photoKey, body: Buffer.from("retained-photo") });
});
afterEach(async () => {
  await prisma.archiveAccessRequest.deleteMany({ where: { coupleId } });
  await prisma.storageCleanup.deleteMany({ where: { key: { in: [avatar, photoKey] } } });
  await prisma.couple.deleteMany({ where: { id: coupleId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await storage.delete(avatar); await storage.delete(photoKey);
});
afterAll(() => prisma.$disconnect());

it("retains IDs and saved content, retires credentials, and creates a separate identity on email reuse", async () => {
  await prisma.userAudio.create({ data: { userId: users[0], ringtone: Buffer.from("saved music"), filename: "song.mp3", contentType: "audio/mpeg" } });
  await prisma.adminAccess.create({ data: { userId: users[0], loginAlias: email } });
  const reset = await prisma.passwordResetToken.create({ data: { userId: users[0], tokenHash: run, expiresAt: new Date(Date.now() + 60000) } });
  const verification = await prisma.emailVerificationToken.create({ data: { userId: users[0], email, tokenHash: run, expiresAt: new Date(Date.now() + 60000) } });
  const session = await createAuthSession({ userId: users[0], tokenVersion: 0 }, true);
  await close();
  const old = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
  expect(old).toMatchObject({ email: expect.stringMatching(/^deleted-[a-f0-9-]+@accounts\.invalid$/), name: "Deleted account", passwordHash: null, emailVerified: null, avatarKey: avatar, tokenVersion: 1 });
  expect(old.deletedAt).not.toBeNull();
  expect(await prisma.adminAccess.findUnique({ where: { userId: users[0] } })).toMatchObject({ loginAlias: null, aliasLookup: null });
  expect(await prisma.passwordResetToken.findUnique({ where: { id: reset.id } })).toMatchObject({ usedAt: expect.any(Date) });
  expect(await prisma.emailVerificationToken.findUnique({ where: { id: verification.id } })).toMatchObject({ usedAt: expect.any(Date), email: old.email });
  expect(Buffer.from((await prisma.userAudio.findUniqueOrThrow({ where: { userId: users[0] } })).ringtone!).toString()).toBe("saved music");
  expect(await prisma.chatMessage.count({ where: { id: messageId } })).toBe(1);
  expect(await prisma.date.count({ where: { id: dateId } })).toBe(1);
  expect(await resolveSessionUser({ userId: users[0], tokenVersion: 0, sessionId: session.id })).toBeNull();
  await expect(authenticate({ email, password })).rejects.toMatchObject({ httpStatus: 401 });
  const fresh = await registerUser({ email: email.toUpperCase(), name: "Same name", password: "NewDemo@123", confirmPassword: "NewDemo@123" }); users.push(fresh.id);
  expect(fresh.id).not.toBe(old.id);
  expect(await prisma.coupleMember.count({ where: { userId: fresh.id } })).toBe(0);
  await prisma.user.update({ where: { id: fresh.id }, data: { emailVerified: new Date() } });
  await expect(asUser(fresh.id, () => requestArchivedAccess(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
  expect((await asUser(fresh.id, () => listMyArchivedSpaces())).rows).toHaveLength(0);
});

it("retires the old OAuth identity so signing in again cannot recover the deleted account", async () => {
  await prisma.account.create({ data: { userId: users[0], provider: "GOOGLE", providerAccountId: run, accessToken: "old-oauth-token" } });
  await close();
  const link = await prisma.account.findFirstOrThrow({ where: { userId: users[0] } });
  expect(link.accessToken).toBeNull(); expect(link.providerAccountId).toBe(`mono:deleted:${link.id}`);
  const fresh = await upsertUserFromOAuthProfile({ provider: "GOOGLE", providerAccountId: run, email, name: "Same name" }); users.push(fresh.id);
  expect(fresh.id).not.toBe(users[0]);
  await expect(asUser(fresh.id, () => requireArchivedRead(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
});

it("only accepts the verified surviving original member's request and notifies admins once", async () => {
  await expect(request()).rejects.toMatchObject({ httpStatus: 404 });
  await close();
  await expect(asUser(users[0], () => requestArchivedAccess(coupleId))).rejects.toMatchObject({ httpStatus: 401 });
  await expect(asUser(users[3], () => requestArchivedAccess(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
  await prisma.user.update({ where: { id: users[1] }, data: { emailVerified: null } });
  await expect(request()).rejects.toThrow();
  await prisma.user.update({ where: { id: users[1] }, data: { emailVerified: new Date() } });
  await Promise.all([request(), request()]);
  expect(await prisma.archiveAccessRequest.count({ where: { coupleId } })).toBe(1);
  expect(await prisma.notification.count({ where: { userId: users[2], entityType: "ArchiveAccessAdmin" } })).toBe(1);
  await expect(asUser(users[1], () => getArchivedSpace(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
});

it("hides archived content from ordinary notification lists while keeping access decisions visible", async () => {
  await prisma.notification.create({ data: { userId: users[1], coupleId, type: "DATE_EDITED", title: "Private old plan" } });
  expect(await getUnreadNotificationCount(users[1])).toBe(1);
  await close();
  expect(await listNotifications(users[1])).toHaveLength(0);
  expect(await getUnreadNotificationCount(users[1])).toBe(0);
  await request(); await grant();
  const notes = await listNotifications(users[1]);
  expect(notes).toHaveLength(1); expect(notes[0].entityType).toBe("ArchiveAccess");
});

it("requires admin approval, keeps writes locked, and supports denial, approval and revocation", async () => {
  await close(); await request();
  const row = await prisma.archiveAccessRequest.findFirstOrThrow({ where: { coupleId } });
  await expect(asUser(users[1], () => reviewArchiveAccess({ requestId: row.id, action: "APPROVED" }))).rejects.toMatchObject({ httpStatus: 403 });
  await expect(asUser(users[1], () => listArchiveAccessRequests())).rejects.toMatchObject({ httpStatus: 403 });
  await grant("DENIED"); await expect(request()).rejects.toMatchObject({ httpStatus: 409 });
  await grant();
  expect((await asUser(users[1], () => getArchivedSpace(coupleId))).name).toBe("Retained shared space");
  expect((await asUser(users[1], () => archivedDates(coupleId, 1))).rows).toHaveLength(1);
  expect((await asUser(users[1], () => archivedMemories(coupleId, 1))).rows[0].body).toBe("Kept text");
  expect((await asUser(users[1], () => archivedExpenses(coupleId, 1))).rows).toHaveLength(1);
  expect((await asUser(users[1], () => archivedPlaces(coupleId, 1))).rows).toHaveLength(1);
  expect((await asUser(users[1], () => archivedPhotos(coupleId, 1))).rows).toHaveLength(1);
  await expect(asUser(users[1], () => requireTogether())).rejects.toThrow();
  await expect(asUser(users[1], () => createDate({ title: "Forbidden new plan" }))).rejects.toThrow();
  expect(await prisma.coupleMember.count({ where: { coupleId, status: "ACTIVE" } })).toBe(0);
  await expect(asUser(users[2], () => getArchivedSpace(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
  await grant("REVOKED");
  await expect(asUser(users[1], () => archivedChat(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
  expect((await prisma.archiveAccessRequest.findUniqueOrThrow({ where: { id: row.id } })).decisions).toHaveLength(4);
});

it("checks media permission before and after approval and preserves retained avatar bytes through cleanup", async () => {
  await queueStorageCleanup([avatar], new Date(Date.now() - 1000));
  await close();
  expect((await asUser(users[1], () => readMedia(photoKey))).status).toBe(404);
  expect((await asUser(users[1], () => readMedia(avatar))).status).toBe(404);
  await processStorageCleanup({ limit: 20 }); expect(await storage.exists(avatar)).toBe(true);
  await request(); await grant();
  expect(await (await asUser(users[1], () => readMedia(photoKey))).text()).toBe("retained-photo");
  expect(await (await asUser(users[1], () => readMedia(avatar))).text()).toBe("retained-avatar");
  expect((await asUser(users[3], () => readMedia(photoKey))).status).toBe(404);
  await grant("REVOKED");
  expect((await asUser(users[1], () => readMedia(photoKey))).status).toBe(404);
  expect((await asUser(users[1], () => readMedia(avatar))).status).toBe(404);
});

it("keeps chat ciphertext and hidden/deleted messages private with stable pagination", async () => {
  await close(); await request(); await grant();
  await prisma.chatMessage.create({ data: { coupleId, senderId: users[0], clientNonce: "hidden", kind: "TEXT", body: "Hidden secret", hiddenFor: [users[1]] } });
  await prisma.chatMessage.create({ data: { coupleId, senderId: users[0], clientNonce: "deleted", kind: "TEXT", body: "Deleted secret", deletedAt: new Date() } });
  for (let i = 0; i < 43; i++) await prisma.chatMessage.create({ data: { coupleId, senderId: users[0], clientNonce: `page-${i}`, kind: "TEXT", body: String(i) } });
  const first = await asUser(users[1], () => archivedChat(coupleId)); expect(first.messages).toHaveLength(40);
  const second = await asUser(users[1], () => archivedChat(coupleId, first.nextCursor));
  const all = [...second.messages, ...first.messages];
  expect(new Set(all.map(m => m.id)).size).toBe(45);
  expect(all.find(m => m.id === messageId)?.body).toBe("Client-encrypted ciphertext");
  expect(JSON.stringify(all)).not.toContain("Hidden secret"); expect(JSON.stringify(all)).not.toContain("Deleted secret");
});

it("retains limited-photo restrictions, checks attachment ownership and blocks revoked image/video reads", async () => {
  const image = await prisma.chatMessage.create({ data: { coupleId, senderId: users[0], clientNonce: "limited", kind: "IMAGE", encrypted: true, image: { create: { coupleId, bytes: Buffer.from("ciphertext"), byteLength: 10, contentType: "image/webp", width: 10, height: 10, encrypted: true, iv: "iv", viewLimit: 1 } } } });
  await close(); await request(); await grant();
  await expect(asUser(users[1], () => readArchivedImage(coupleId, image.id, false))).rejects.toMatchObject({ httpStatus: 422 });
  const attempts = await Promise.allSettled([asUser(users[1], () => readArchivedImage(coupleId, image.id, true)), asUser(users[1], () => readArchivedImage(coupleId, image.id, true))]);
  expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const chat = await asUser(users[1], () => archivedChat(coupleId)); expect(chat.messages.find(m => m.id === image.id)?.image?.url).toContain(`/history-access/${coupleId}/images/`);
  await expect(asUser(users[3], () => readArchivedImage(coupleId, image.id, true))).rejects.toMatchObject({ httpStatus: 404 });
  await grant("REVOKED");
  await expect(asUser(users[1], () => readArchivedImage(coupleId, image.id, true))).rejects.toMatchObject({ httpStatus: 404 });
  await expect(asUser(users[1], () => readArchivedVideo(coupleId, image.id))).rejects.toMatchObject({ httpStatus: 404 });
});

it("does not reveal the deleted partner's blind review or unshared venue score", async () => {
  const place = await prisma.place.findFirstOrThrow({ where: { coupleId } });
  const other = await prisma.dateReview.create({ data: { dateId, authorId: users[0], overallRating: 8, lovedText: "Private until reveal", submittedAt: new Date(), placeRatings: { create: { placeId: place.id, score: 7 } } } });
  const mine = await prisma.dateReview.create({ data: { dateId, authorId: users[1], overallRating: 9, lovedText: "My draft" } });
  await close(); await request(); await grant();
  expect((await asUser(users[1], () => archivedDate(coupleId, dateId))).reviews.map(r => r.id)).toEqual([mine.id]);
  await prisma.dateReview.update({ where: { id: mine.id }, data: { submittedAt: new Date() } });
  const revealed = await asUser(users[1], () => archivedDate(coupleId, dateId));
  expect(revealed.reviews).toHaveLength(2); expect(revealed.reviews.find(r => r.id === other.id)?.placeRatings).toHaveLength(0);
  await prisma.datePlaceRating.create({ data: { reviewId: mine.id, placeId: place.id, score: 9 } });
  expect((await asUser(users[1], () => archivedDate(coupleId, dateId))).reviews.find(r => r.id === other.id)?.placeRatings).toHaveLength(1);
});

it("serves only approved archived video chunks and rechecks revocation after file I/O", async () => {
  const videoKey = `couples/${coupleId}/chat-video/fixture/0.bin`;
  const message = await prisma.chatMessage.create({ data: { coupleId, senderId: users[0], clientNonce: "video", kind: "VIDEO", encrypted: true } });
  await prisma.chatVideo.create({ data: { coupleId, senderId: users[0], clientNonce: "video", keyId: "existing-key", body: "encrypted-meta", byteLength: 5, chunkCount: 1, messageId: message.id, expiresAt: new Date(), parts: { create: { index: 0, storageKey: videoKey, byteLength: 5, iv: "iv", digest: "digest" } } } });
  await storage.put({ key: videoKey, body: Buffer.from("encrypted video chunk") });
  try {
    await close(); await request();
    await expect(asUser(users[1], () => readArchivedVideo(coupleId, message.id))).rejects.toMatchObject({ httpStatus: 404 });
    await grant();
    expect(await asUser(users[1], () => readArchivedVideo(coupleId, message.id))).toEqual({ chunkCount: 1, byteLength: 5 });
    expect(await asUser(users[1], () => readArchivedVideo(coupleId, message.id, 0))).toEqual({ iv: "iv", data: Buffer.from("encrypted video chunk").toString("base64") });
    const get = storage.get.bind(storage);
    const spy = vi.spyOn(storage, "get").mockImplementationOnce(async key => { const bytes = await get(key); await grant("REVOKED"); return bytes; });
    try { await expect(asUser(users[1], () => readArchivedVideo(coupleId, message.id, 0))).rejects.toMatchObject({ httpStatus: 404 }); }
    finally { spy.mockRestore(); }
  } finally { await storage.delete(videoKey); }
});

it("rechecks eligibility on approval and reads when either account changes", async () => {
  await close(); await request();
  await prisma.user.update({ where: { id: users[1] }, data: { blockedAt: new Date() } });
  await expect(grant()).rejects.toMatchObject({ httpStatus: 404 });
  await prisma.user.update({ where: { id: users[1] }, data: { blockedAt: null } });
  await grant();
  await prisma.user.update({ where: { id: users[0] }, data: { deletedAt: null } });
  await expect(asUser(users[1], () => requireArchivedRead(coupleId))).rejects.toMatchObject({ httpStatus: 404 });
});
