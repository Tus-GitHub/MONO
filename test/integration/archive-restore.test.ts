import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: async () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
vi.mock("@/server/services/session-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/session-service")>();
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { ...original, requireAuthSession: async () => {
    const session = await prisma.authSession.findFirstOrThrow({ where: { userId: testUser.getStore()!, revokedAt: null, expiresAt: { gt: new Date() } } });
    return { userId: session.userId, sessionId: session.id, tokenVersion: session.tokenVersion };
  } };
});

import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { archiveDigest, approveArchiveRestore, exportCoupleArchive, parseArchive, restoreCoupleArchive } from "@/server/services/archive-service";
import type { CoupleArchive } from "@/lib/validation/archive";
import { env } from "@/config/env";
import { GET as getMedia } from "@/app/media/[...key]/route";

let users: string[] = [];
let couples: string[] = [];
let sourceId: string;
let sourceDate: string;
let photoId: string;
let image: Buffer;
const keys = new Set<string>();

beforeEach(async () => {
  const token = randomUUID();
  users = (await Promise.all([0, 1].map((n) => prisma.user.create({ data: { email: `archive-${token}-${n}@example.invalid`, name: `Archive fixture ${n}` } })))).map((item) => item.id);
  await prisma.authSession.createMany({ data: users.map((userId) => ({ userId, tokenVersion: 0, expiresAt: new Date(Date.now() + 3_600_000), deviceLabel: "Archive fixture" })) });
  sourceId = await newSpace();
  const place = await prisma.place.create({ data: { coupleId: sourceId, createdById: users[1], name: "Preserved cafe", category: "CAFE", address: "123 fixture lane", latitude: 20, longitude: 70, notes: "Saved notes" } });
  sourceDate = (await prisma.date.create({ data: { coupleId: sourceId, createdById: users[0], title: "Archive date", status: "COMPLETED", currency: "INR", plannedPlaceId: place.id, actualPlaceId: place.id, scheduledFor: new Date("2030-01-01T00:00:00Z"), completedAt: new Date("2030-01-01T21:00:00Z"), actualNotes: "The actual recap" } })).id;
  image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
  const key = `couples/${sourceId}/dates/${sourceDate}/archive-fixture.webp`;
  keys.add(key);
  await storage.put({ key, body: image, contentType: "image/webp" });
  photoId = (await prisma.datePhoto.create({ data: { dateId: sourceDate, uploadedById: users[1], storageKey: key, displayKey: key, thumbKey: key, url: storage.publicUrl(key), caption: "Kept caption", width: 2, height: 2, contentType: "image/webp" } })).id;
  await prisma.date.update({ where: { id: sourceDate }, data: { bestPhotoId: photoId } });
  await prisma.couple.update({ where: { id: sourceId }, data: { photoKey: key, photoUrl: storage.publicUrl(key) } });
  await prisma.dateActivity.create({ data: { dateId: sourceDate, title: "Walk", placeId: place.id, durationMinutes: 45, costCents: 50 } });
  const category = await prisma.reviewCategory.create({ data: { coupleId: sourceId, key: "company", label: "Company" } });
  for (const authorId of users) await prisma.dateReview.create({ data: { dateId: sourceDate, authorId, overallRating: 9, submittedAt: new Date(), lovedText: "Shared after reveal", ratings: { create: { categoryId: category.id, score: 9, note: "Kept rating note" } } } });
  await prisma.revisitDecision.create({ data: { dateId: sourceDate, decidedById: users[1], choice: "YES", reason: "Again" } });
  await prisma.expense.createMany({ data: [{ coupleId: sourceId, dateId: sourceDate, recordedById: users[1], description: "Dinner", amountCents: 1000, currency: "INR", paidBy: "CUSTOM", ownerShareCents: 400 }, { coupleId: sourceId, recordedById: users[0], description: "Standalone", amountCents: 200, currency: "USD" }] });
  await prisma.memory.createMany({ data: [{ coupleId: sourceId, dateId: sourceDate, authorId: users[1], title: "Kept memory", body: "Remember this", coverPhotoId: photoId }, { coupleId: sourceId, authorId: users[0], title: "Standalone memory", body: "Outside a date" }] });
  await prisma.dateEvent.create({ data: { dateId: sourceDate, actorId: users[0], kind: "CREATED", summary: "created this date", meta: { fixture: true } } });
  await prisma.dateReminder.createMany({ data: users.map((userId) => ({ dateId: sourceDate, userId, kind: "CUSTOM", scheduledFor: new Date("2035-01-01T00:00:00Z") })) });
  await prisma.recommendationFeedback.create({ data: { coupleId: sourceId, userId: users[1], targetType: "PLACE", targetKey: place.id, signal: "SAVED" } });
});

afterEach(async () => {
  vi.restoreAllMocks();
  const photos = await prisma.datePhoto.findMany({ where: { date: { coupleId: { in: couples } } }, select: { storageKey: true, displayKey: true, thumbKey: true } });
  const scope = couples.map((id) => ({ key: { startsWith: `couples/${id}/` } }));
  const tasks = await prisma.storageCleanup.findMany({ where: { OR: scope }, select: { key: true } });
  for (const item of photos) for (const key of [item.storageKey, item.displayKey, item.thumbKey]) if (key) keys.add(key);
  for (const task of tasks) keys.add(task.key);
  for (const key of keys) await storage.delete(key);
  await prisma.storageCleanup.deleteMany({ where: { OR: scope } });
  await prisma.couple.deleteMany({ where: { id: { in: couples } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  keys.clear(); users = []; couples = [];
});

async function newSpace() {
  const couple = await prisma.couple.create({ data: { createdById: users[0], inviteCode: randomUUID(), status: "ACTIVE", currency: "INR", timezone: "Asia/Kolkata", name: "Archive couple", members: { create: users.map((userId, n) => ({ userId, role: n === 0 ? "OWNER" : "PARTNER" })) } } });
  couples.push(couple.id);
  return couple.id;
}
async function emptyTarget() {
  await prisma.coupleMember.updateMany({ where: { coupleId: sourceId }, data: { status: "LEFT" } });
  await prisma.couple.update({ where: { id: sourceId }, data: { status: "ARCHIVED" } });
  return newSpace();
}
async function approvals(archive: CoupleArchive) { return Promise.all(users.map((user) => asUser(user, async () => (await approveArchiveRestore(archive)).approval))); }
function resign(archive: CoupleArchive, mutate: (draft: CoupleArchive) => void) {
  const value = JSON.parse(JSON.stringify(archive)) as CoupleArchive;
  mutate(value);
  const { digest: _digest, ...payload } = value;
  value.digest = archiveDigest(payload);
  return value;
}

it("round-trips shared history, standalone records, authors, references and embedded media to fresh IDs", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  expect(archive.media).toHaveLength(1);
  expect(archive.reminders).toHaveLength(1);
  expect(JSON.stringify(archive)).not.toMatch(/passwordHash|tokenVersion|inviteCode|pushSubscription|storageKey/);
  const target = await emptyTarget();
  const approved = await approvals(archive);
  expect(await asUser(users[0], () => restoreCoupleArchive(archive, approved))).toMatchObject({ restored: true, dates: 1, photos: 1, memories: 2 });
  const date = await prisma.date.findFirstOrThrow({ where: { coupleId: target }, include: { plannedPlace: true, activities: true, photos: true, reviews: { include: { ratings: true } }, memory: true, expenses: true, reminders: true, revisitDecision: true, events: true } });
  expect(date.id).not.toBe(sourceDate);
  expect(date.plannedPlace?.name).toBe("Preserved cafe");
  expect(date.activities[0].placeId).toBe(date.plannedPlaceId);
  expect(date.bestPhotoId).toBe(date.photos[0].id);
  expect(date.memory?.coverPhotoId).toBe(date.photos[0].id);
  expect(date.memory?.authorId).toBe(users[1]);
  expect(date.reviews).toHaveLength(2);
  expect(date.reviews[0].ratings[0].note).toBe("Kept rating note");
  expect(date.expenses[0]).toMatchObject({ ownerShareCents: 400, recordedById: users[1] });
  expect(date.reminders[0].dismissedAt).toBeInstanceOf(Date);
  expect(date.revisitDecision?.decidedById).toBe(users[1]);
  expect(date.events[0].summary).toBe("created this date");
  expect(await storage.get(date.photos[0].storageKey)).toEqual(image);
  const response = await asUser(users[1], () => getMedia(new NextRequest(`http://localhost:3000/media/${date.photos[0].storageKey}`), { params: Promise.resolve({ key: date.photos[0].storageKey.split("/") }) }));
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
  expect(date.photos[0].storageKey).toContain(`couples/${target}/restored/`);
  expect(await prisma.expense.count({ where: { coupleId: target } })).toBe(2);
  expect(await prisma.memory.count({ where: { coupleId: target } })).toBe(2);
  expect(await prisma.recommendationFeedback.findFirst({ where: { coupleId: target } })).toMatchObject({ targetKey: date.plannedPlaceId });
  expect(await prisma.couple.findUnique({ where: { id: target } })).toMatchObject({ photoKey: date.photos[0].storageKey });
  expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(1);
  expect(await prisma.notification.count({ where: { coupleId: target } })).toBe(0);
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, approved))).rejects.toMatchObject({ code: "conflict" });
});

it("keeps private partner submissions/drafts out while retaining the exporter's own draft", async () => {
  await prisma.dateReview.update({ where: { dateId_authorId: { dateId: sourceDate, authorId: users[0] } }, data: { submittedAt: null, lovedText: "MY PRIVATE DRAFT" } });
  await prisma.dateReview.update({ where: { dateId_authorId: { dateId: sourceDate, authorId: users[1] } }, data: { lovedText: "HIDDEN PARTNER SUBMISSION" } });
  const mine = await asUser(users[0], exportCoupleArchive);
  expect(mine.reviews).toHaveLength(1);
  expect(JSON.stringify(mine)).toContain("MY PRIVATE DRAFT");
  expect(JSON.stringify(mine)).not.toContain("HIDDEN PARTNER SUBMISSION");
  const theirs = await asUser(users[1], exportCoupleArchive);
  expect(JSON.stringify(theirs)).not.toContain("MY PRIVATE DRAFT");
});

it("refuses a populated destination or missing partner approval before writing any media", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  await expect(asUser(users[0], () => approveArchiveRestore(archive))).rejects.toMatchObject({ code: "conflict" });
  const target = await emptyTarget();
  const one = await asUser(users[0], () => approveArchiveRestore(archive));
  const put = vi.spyOn(storage, "put");
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, [one.approval]))).rejects.toMatchObject({ code: "authorization_error" });
  expect(put).not.toHaveBeenCalled();
  expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(0);
});

it("rejects forged identities, checksums, foreign graph references and active media types", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  expect(() => parseArchive({ ...archive, digest: "0".repeat(64) })).toThrow();
  expect(() => parseArchive(resign(archive, (draft) => { draft.dates[0].plannedPlaceId = "foreign-place"; }))).toThrow();
  expect(() => parseArchive(resign(archive, (draft) => { draft.media[0].contentType = "image/svg+xml" as "image/webp"; }))).toThrow();
  const wrongPeople = resign(archive, (draft) => { draft.members[1].email = "someone-else@example.invalid"; });
  await emptyTarget();
  await expect(asUser(users[0], () => approveArchiveRestore(wrongPeople))).rejects.toMatchObject({ code: "authorization_error" });
  const crossDate = resign(archive, (draft) => { draft.photos[0].dateId = "foreign-date"; });
  await expect(asUser(users[0], () => restoreCoupleArchive(crossDate, []))).rejects.toMatchObject({ code: "validation_error" });
});

it("binds approvals to the exact manifest, destination and live approver session", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  await emptyTarget();
  const approved = await approvals(archive);
  const changed = resign(archive, (draft) => { draft.dates[0].title = "Changed after consent"; });
  await expect(asUser(users[0], () => restoreCoupleArchive(changed, approved))).rejects.toMatchObject({ code: "authorization_error" });
  await prisma.authSession.updateMany({ where: { userId: users[1] }, data: { revokedAt: new Date() } });
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, approved))).rejects.toMatchObject({ code: "authorization_error" });
});

it("refuses expired and duplicate approvals", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  const target = await emptyTarget();
  const approved = await approvals(archive);
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, [approved[0], approved[0]]))).rejects.toMatchObject({ code: "authorization_error" });
  const partner = await prisma.authSession.findFirstOrThrow({ where: { userId: users[1] } });
  const expired = await new SignJWT({ digest: archive.digest, coupleId: target, sid: partner.id, tv: partner.tokenVersion }).setProtectedHeader({ alg: "HS256" }).setIssuer("mono").setAudience("mono:archive-restore").setSubject(users[1]).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(new TextEncoder().encode(env.AUTH_SECRET));
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, [approved[0], expired]))).rejects.toMatchObject({ code: "authorization_error" });
});

it("commits exactly one concurrent restore and retains cleanup for the losing stage", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  const target = await emptyTarget();
  const approved = await approvals(archive);
  const attempts = await Promise.allSettled([asUser(users[0], () => restoreCoupleArchive(archive, approved)), asUser(users[0], () => restoreCoupleArchive(archive, approved))]);
  expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.date.count({ where: { coupleId: target } })).toBe(1);
  expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(1);
  expect(await prisma.storageCleanup.count({ where: { key: { startsWith: `couples/${target}/restored/` } } })).toBe(1);
});

it("preserves content added to the destination while restore media was staging", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  const target = await emptyTarget();
  const approved = await approvals(archive);
  const put = storage.put.bind(storage);
  vi.spyOn(storage, "put").mockImplementationOnce(async (input) => {
    const value = await put(input);
    await prisma.date.create({ data: { coupleId: target, createdById: users[1], title: "New work during restore" } });
    return value;
  });
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, approved))).rejects.toMatchObject({ code: "conflict" });
  expect(await prisma.date.findMany({ where: { coupleId: target }, select: { title: true } })).toEqual([{ title: "New work during restore" }]);
  expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(0);
});

it("rolls back every database record and receipt when the final metadata update fails", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  const target = await emptyTarget();
  const seed = await prisma.reviewCategory.create({ data: { coupleId: target, key: "seed", label: "Original seed" } });
  const approved = await approvals(archive);
  const constraint = `archive_fixture_${randomUUID().replaceAll("-", "")}`;
  // Trusted generated identifiers / CUID, never user input; NOT VALID allows the existing row.
  expect(target).toMatch(/^[a-z0-9]+$/);
  await prisma.$executeRawUnsafe(`ALTER TABLE couples ADD CONSTRAINT "${constraint}" CHECK (id <> '${target}') NOT VALID`);
  try {
    await expect(asUser(users[0], () => restoreCoupleArchive(archive, approved))).rejects.toThrow();
    expect(await prisma.date.count({ where: { coupleId: target } })).toBe(0);
    expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(0);
    expect(await prisma.reviewCategory.findUnique({ where: { id: seed.id } })).not.toBeNull();
    const tasks = await prisma.storageCleanup.findMany({ where: { key: { startsWith: `couples/${target}/restored/` } } });
    expect(tasks).toHaveLength(1);
    expect(await storage.exists(tasks[0].key)).toBe(true);
  } finally { await prisma.$executeRawUnsafe(`ALTER TABLE couples DROP CONSTRAINT "${constraint}"`); }
});

it("leaves durable cleanup tasks and no restored rows after a storage failure", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  const target = await emptyTarget();
  const approved = await approvals(archive);
  vi.spyOn(storage, "put").mockRejectedValueOnce(new Error("Fixture storage outage"));
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, approved))).rejects.toThrow("Fixture storage outage");
  expect(await prisma.date.count({ where: { coupleId: target } })).toBe(0);
  expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(0);
  expect(await prisma.storageCleanup.count({ where: { key: { startsWith: `couples/${target}/restored/` } } })).toBe(1);
});

it("rechecks membership after uploading media before committing the archive", async () => {
  const archive = await asUser(users[0], exportCoupleArchive);
  const target = await emptyTarget();
  const approved = await approvals(archive);
  const put = storage.put.bind(storage);
  vi.spyOn(storage, "put").mockImplementationOnce(async (input) => {
    const value = await put(input);
    await prisma.coupleMember.updateMany({ where: { coupleId: target, userId: users[1] }, data: { status: "LEFT" } });
    return value;
  });
  await expect(asUser(users[0], () => restoreCoupleArchive(archive, approved))).rejects.toMatchObject({ code: "authorization_error" });
  expect(await prisma.date.count({ where: { coupleId: target } })).toBe(0);
  expect(await prisma.archiveRestore.count({ where: { coupleId: target } })).toBe(0);
});

it("fails an export as a whole when referenced media is missing", async () => {
  const photo = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photoId } });
  await storage.delete(photo.storageKey);
  await expect(asUser(users[0], exportCoupleArchive)).rejects.toThrow();
});
