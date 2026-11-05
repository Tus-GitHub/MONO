import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { asUser } from "./auth-context";

const transport = vi.hoisted(() => ({ send: vi.fn(), configured: true }));
vi.mock("@/lib/notifications/push", () => ({ getPushChannel: () => ({ name: "fixture", configured: transport.configured, send: transport.send }) }));
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: async () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});

import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { parseHistoryParams } from "@/lib/date/history-filters";
import { PushSubscriptionGoneError } from "@/lib/notifications/web-push";
import { setPushSubscription } from "@/server/services/notification-preference-service";
import { enqueueNotification, processNotificationDeliveries } from "@/server/services/notification-delivery-service";
import { dispatchDueRemindersDetailed } from "@/server/services/reminder-service";
import { getBestPhotoWallPage, addDatePhoto, deleteDatePhoto, replaceDatePhoto } from "@/server/services/photo-service";
import { getDateHistory } from "@/server/services/history-service";
import { isActiveMediaKey, processStorageCleanup, queueStorageCleanup, MEDIA_RETENTION_MS } from "@/server/services/storage-cleanup-service";
import type { ProcessedImage } from "@/lib/images";
import { NextRequest } from "next/server";
import { GET as getMedia } from "@/app/media/[...key]/route";
import { saveUserAvatar, saveCoupleCover } from "@/server/services/profile-media-service";
import { deleteDatePlan } from "@/server/services/plan-service";

const token = randomUUID();
let users: string[] = [];
let coupleId: string;
const publicKey = (() => { const key = createECDH("prime256v1"); key.generateKeys(); return key.getPublicKey().toString("base64url"); })();
const subscription = (name: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${token}-${name}`, keys: { p256dh: publicKey, auth: randomBytes(16).toString("base64url") } });

beforeAll(async () => {
  users = (await Promise.all([0, 1].map((n) => prisma.user.create({ data: { email: `reliability-${token}-${n}@example.invalid`, name: "Reliability fixture" } })))).map((user) => user.id);
  coupleId = (await prisma.couple.create({
    data: {
      createdById: users[0], inviteCode: token, status: "ACTIVE",
      members: { create: [{ userId: users[0], role: "OWNER" }, { userId: users[1], role: "PARTNER" }] },
    }
  })).id;
});
beforeEach(async () => {
  transport.configured = true;
  transport.send.mockReset().mockResolvedValue(undefined);
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: users } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: users } } });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  const photos = await prisma.datePhoto.findMany({ where: { date: { coupleId } }, select: { storageKey: true, displayKey: true, thumbKey: true } });
  const scope = [{ key: { startsWith: `couples/${coupleId}/` } }, ...users.map((id) => ({ key: { startsWith: `users/${id}/` } }))];
  const tasks = await prisma.storageCleanup.findMany({ where: { OR: scope }, select: { key: true } });
  const avatars = await prisma.user.findMany({ where: { id: { in: users } }, select: { avatarKey: true } });
  const couple = await prisma.couple.findUnique({ where: { id: coupleId }, select: { photoKey: true } });
  const keys = new Set([...photos.flatMap((photo) => [photo.storageKey, photo.displayKey, photo.thumbKey]), ...tasks.map((task) => task.key), ...avatars.map((user) => user.avatarKey), couple?.photoKey]);
  for (const key of keys) if (key) await storage.delete(key);
  await prisma.storageCleanup.deleteMany({ where: { OR: scope } });
  await prisma.couple.deleteMany({ where: { id: coupleId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

async function queue() {
  const note = await prisma.$transaction((tx) => enqueueNotification(tx, users[0], { type: "SYSTEM", title: "Fixture notification" }, coupleId));
  // These cases test jobs already due. Avoid comparing PostgreSQL's microsecond clock with
  // Windows' coarser JavaScript clock immediately after the database DEFAULT now().
  await prisma.notificationDelivery.updateMany({ where: { notificationId: note.id }, data: { nextAttemptAt: new Date(Date.now() - 1_000) } });
  return note;
}
async function date() {
  return prisma.date.create({ data: { coupleId, createdById: users[0], title: "Reliability date", status: "COMPLETED", completedAt: new Date() } });
}
const processed: ProcessedImage = {
  original: { buffer: Buffer.from("fixture"), contentType: "image/webp", bytes: 7, width: 1, height: 1 },
  display: { buffer: Buffer.from("fixture"), contentType: "image/webp", bytes: 7, width: 1, height: 1 },
  thumb: { buffer: Buffer.from("fixture"), contentType: "image/webp", bytes: 7, width: 1, height: 1 },
  ext: "webp", width: 1, height: 1, blurDataUrl: "",
};

it("persists one delivery per browser and disabling one preserves the other", async () => {
  const phone = subscription("phone");
  const laptop = subscription("laptop");
  await setPushSubscription(users[0], phone);
  await setPushSubscription(users[0], laptop);
  await queue();
  expect(await prisma.notificationDelivery.count({ where: { userId: users[0] } })).toBe(2);
  await setPushSubscription(users[0], null, phone.endpoint);
  const result = await processNotificationDeliveries({ userId: users[0] });
  expect(result).toMatchObject({ delivered: 1, cancelled: 1 });
  expect(transport.send).toHaveBeenCalledOnce();
  expect((transport.send.mock.calls[0][0] as { endpoint: string }).endpoint).toBe(laptop.endpoint);
});

it("retries a transient error without recreating or losing the in-app notification", async () => {
  await setPushSubscription(users[0], subscription("retry"));
  const notification = await queue();
  transport.send.mockRejectedValueOnce(new Error("temporary provider failure"));
  expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ failed: 1 });
  const pending = await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } });
  expect(pending.status).toBe("PENDING");
  expect(pending.attempts).toBe(1);
  expect(pending.lastError).toBe("delivery_failed");
  expect(await prisma.notification.count({ where: { id: notification.id } })).toBe(1);
  expect(await processNotificationDeliveries({ userId: users[0], now: new Date(pending.nextAttemptAt.getTime() + 1) })).toMatchObject({ delivered: 1 });
  expect(transport.send).toHaveBeenCalledTimes(2);
});

it("concurrent delivery workers claim each task only once", async () => {
  await setPushSubscription(users[0], subscription("race"));
  await queue();
  const results = await Promise.all([processNotificationDeliveries({ userId: users[0] }), processNotificationDeliveries({ userId: users[0] })]);
  expect(results.reduce((sum, result) => sum + result.delivered, 0)).toBe(1);
  expect(transport.send).toHaveBeenCalledOnce();
});

it("recovers an expired worker lease and bounds repeated failures", async () => {
  await setPushSubscription(users[0], subscription("lease"));
  const notification = await queue();
  const job = await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } });
  await prisma.notificationDelivery.update({ where: { id: job.id }, data: { status: "PROCESSING", attempts: 1, leaseToken: "dead-worker", leaseUntil: new Date(Date.now() - 1_000) } });
  expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ delivered: 1 });
  const failed = await queue();
  transport.send.mockRejectedValue(new Error("provider unavailable"));
  for (let attempt = 0;attempt < 6;attempt++) {
    const current = await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: failed.id } });
    await processNotificationDeliveries({ userId: users[0], now: new Date(current.nextAttemptAt.getTime() + 1) });
  }
  expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: failed.id } })).status).toBe("FAILED");
  expect(transport.send).toHaveBeenCalledTimes(7);
});

it("a stale expiry response removes neither rotated keys nor another device", async () => {
  const phone = subscription("rotate");
  await setPushSubscription(users[0], phone);
  const originalDevice = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: phone.endpoint } });
  await setPushSubscription(users[0], subscription("unaffected"));
  await queue();
  transport.send.mockImplementation(async (data: { endpoint: string }) => {
    if (data.endpoint === phone.endpoint) {
      await setPushSubscription(users[0], { ...phone, keys: { ...phone.keys, auth: randomBytes(16).toString("base64url") } });
      // Force a same-millisecond update; timestamp equality alone must not delete rotated keys.
      await prisma.pushSubscription.update({ where: { endpoint: phone.endpoint }, data: { updatedAt: originalDevice.updatedAt } });
      throw new PushSubscriptionGoneError();
    }
  });
  await processNotificationDeliveries({ userId: users[0] });
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(2);
});

it("cancels queued work when preferences, membership, or endpoint ownership changes", async () => {
  const sub = subscription("ownership");
  await setPushSubscription(users[0], sub);
  await queue();
  await setPushSubscription(users[1], sub);
  expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ cancelled: 1 });
  expect(transport.send).not.toHaveBeenCalled();
  await setPushSubscription(users[0], subscription("mute"));
  await queue();
  await prisma.notificationPreference.update({ where: { userId: users[0] }, data: { pushEnabled: false } });
  expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ cancelled: 1 });
  expect(transport.send).not.toHaveBeenCalled();
  await prisma.notificationPreference.update({ where: { userId: users[0] }, data: { pushEnabled: true } });
  await queue();
  await prisma.coupleMember.update({ where: { coupleId_userId: { coupleId, userId: users[0] } }, data: { status: "LEFT" } });
  try {
    expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ cancelled: 1 });
    expect(transport.send).not.toHaveBeenCalled();
  } finally {
    await prisma.coupleMember.update({ where: { coupleId_userId: { coupleId, userId: users[0] } }, data: { status: "ACTIVE" } });
  }
});

it("keeps queued pushes pending when VAPID is not configured", async () => {
  await setPushSubscription(users[0], subscription("disabled"));
  const notification = await queue();
  transport.configured = false;
  await processNotificationDeliveries({ userId: users[0] });
  expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } })).attempts).toBe(0);
  expect(transport.send).not.toHaveBeenCalled();
});

it("snoozing a reminder cancels its previously queued occurrence", async () => {
  await setPushSubscription(users[0], subscription("snooze"));
  const planned = await prisma.date.create({ data: { coupleId, createdById: users[0], title: "Snooze", status: "PLANNED" } });
  const reminder = await prisma.dateReminder.create({ data: { dateId: planned.id, userId: users[0], kind: "CUSTOM", scheduledFor: new Date(Date.now() - 100) } });
  expect(await dispatchDueRemindersDetailed(users[0])).toMatchObject({ delivered: 1, failed: 0 });
  await prisma.dateReminder.update({ where: { id: reminder.id }, data: { scheduledFor: new Date(Date.now() + 86_400_000), sentAt: null } });
  expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ cancelled: 1 });
  expect(transport.send).not.toHaveBeenCalled();
});

it("photo cursors retain every photo when completion timestamps are identical", async () => {
  const dates = Array.from({ length: 7 }, (_, index) => ({
    id: `photo-page-${token}-${index}`, coupleId, createdById: users[0], title: "Photo page", status: "COMPLETED" as const,
    completedAt: new Date("2026-08-01T12:00:00Z"),
  }));
  await prisma.date.createMany({ data: dates });
  await prisma.datePhoto.createMany({ data: dates.map((item) => ({ id: `image-${item.id}`, dateId: item.id, uploadedById: users[0], storageKey: `couples/${coupleId}/dates/${item.id}/photos/fixture.webp`, url: "/media/fixture" })) });
  await prisma.$transaction(dates.map((item) => prisma.date.update({ where: { id: item.id }, data: { bestPhotoId: `image-${item.id}` } })));
  let cursor: string | undefined;
  const seen: string[] = [];
  do {
    const page = await asUser(users[0], () => getBestPhotoWallPage(cursor, 2));
    seen.push(...page.photos.map((photo) => photo.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(seen).toHaveLength(7);
  expect(new Set(seen).size).toBe(7);
});

it("history searches and totals include matching records beyond the first 250 dates", async () => {
  await prisma.date.createMany({
    data: Array.from({ length: 260 }, (_, index) => ({
      coupleId, createdById: users[0], title: `Newer ${index}`, status: "COMPLETED", scheduledFor: new Date("2030-07-01T00:00:00Z"), completedAt: new Date(),
    }))
  });
  const older = await prisma.date.create({ data: { coupleId, createdById: users[0], title: "Older matching date", status: "COMPLETED", scheduledFor: new Date("2020-06-01T00:00:00Z"), completedAt: new Date("2020-06-01T20:00:00Z") } });
  await prisma.dateReview.createMany({ data: users.map((authorId) => ({ dateId: older.id, authorId, overallRating: 9, submittedAt: new Date() })) });
  const result = await asUser(users[0], () => getDateHistory(parseHistoryParams({ month: "6", score: "9" })));
  expect(result.items.map((item) => item.id)).toEqual([older.id]);
  expect(result.total).toBe(1);
  const all = await asUser(users[0], () => getDateHistory(parseHistoryParams({})));
  expect(all.items).toHaveLength(250);
  expect(all.total).toBe(await prisma.date.count({ where: { coupleId, deletedAt: null, status: "COMPLETED" } }));
});

it("photo deletion retains bytes temporarily, revokes references, then purges all variants", async () => {
  const item = await date();
  const photo = await asUser(users[0], () => addDatePhoto(item.id, processed, "fixture.webp"));
  const row = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  expect(await storage.exists(row.storageKey)).toBe(true);
  await asUser(users[0], () => deleteDatePhoto(photo.id));
  expect(await isActiveMediaKey(row.storageKey)).toBe(false);
  expect(await storage.exists(row.storageKey)).toBe(true);
  expect(await prisma.storageCleanup.count({ where: { key: { in: [row.storageKey, row.displayKey!, row.thumbKey!] } } })).toBe(3);
  await processStorageCleanup({ now: new Date(Date.now() + MEDIA_RETENTION_MS + 10_000) });
  expect(await storage.exists(row.storageKey)).toBe(false);
});

it("a partial upload failure leaves staged cleanup work for every possible orphan", async () => {
  const item = await date();
  const original = storage.put.bind(storage);
  let writes = 0;
  vi.spyOn(storage, "put").mockImplementation(async (input) => {
    writes++;
    if (writes === 2) throw new Error("injected storage failure");
    return original(input);
  });
  await expect(asUser(users[0], () => addDatePhoto(item.id, processed, "failure.webp"))).rejects.toThrow("injected storage failure");
  expect(await prisma.datePhoto.count({ where: { dateId: item.id } })).toBe(0);
  const tasks = await prisma.storageCleanup.findMany({ where: { key: { startsWith: `couples/${coupleId}/dates/${item.id}/` } } });
  expect(tasks).toHaveLength(3);
  await processStorageCleanup({ now: new Date(Date.now() + 2 * 60 * 60_000) });
  for (const task of tasks) expect(await storage.exists(task.key)).toBe(false);
});

it("cleanup retries failed deletes and never removes a currently referenced object", async () => {
  const item = await date();
  const photo = await asUser(users[0], () => addDatePhoto(item.id, processed, "active.webp"));
  const row = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  await queueStorageCleanup([row.storageKey], new Date());
  const kept = await processStorageCleanup();
  expect(kept.kept).toBe(1);
  expect(await storage.exists(row.storageKey)).toBe(true);
  const orphan = `couples/${coupleId}/orphan-${randomUUID()}.webp`;
  await storage.put({ key: orphan, body: Buffer.from("fixture") });
  await queueStorageCleanup([orphan], new Date());
  const originalDelete = storage.delete.bind(storage);
  vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("temporary delete failure"));
  expect(await processStorageCleanup()).toMatchObject({ failed: 1 });
  const task = await prisma.storageCleanup.findUniqueOrThrow({ where: { key: orphan } });
  expect(task.attempts).toBe(1);
  vi.mocked(storage.delete).mockImplementation(originalDelete);
  await processStorageCleanup({ now: new Date(task.nextAttemptAt.getTime() + 1) });
  expect(await storage.exists(orphan)).toBe(false);
});

it("replacing a photo stages the new upload and queues the old variants atomically", async () => {
  const item = await date();
  const photo = await asUser(users[0], () => addDatePhoto(item.id, processed, "first.webp"));
  const old = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  await asUser(users[0], () => replaceDatePhoto(photo.id, processed, "replacement.webp"));
  const current = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  expect(current.storageKey).not.toBe(old.storageKey);
  expect(await isActiveMediaKey(old.storageKey)).toBe(false);
  expect(await isActiveMediaKey(current.storageKey)).toBe(true);
  expect(await prisma.storageCleanup.count({ where: { key: { in: [current.storageKey, current.displayKey!, current.thumbKey!] } } })).toBe(0);
});

it("media revalidates authorization before returning cached or retained deleted content", async () => {
  const item = await date();
  const photo = await asUser(users[0], () => addDatePhoto(item.id, processed, "media.webp"));
  const row = await prisma.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  const params = { params: Promise.resolve({ key: row.storageKey.split("/") }) };
  const response = await asUser(users[0], () => getMedia(new NextRequest(`http://localhost/media/${row.storageKey}`), params));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-cache");
  const conditional = new NextRequest(`http://localhost/media/${row.storageKey}`, { headers: { "if-none-match": response.headers.get("etag")! } });
  expect((await asUser(users[0], () => getMedia(conditional, params))).status).toBe(304);
  await asUser(users[0], () => deleteDatePhoto(photo.id));
  expect((await asUser(users[0], () => getMedia(conditional, params))).status).toBe(404);
});

it("profile image replacements keep cleanup transactional and preserve the current object", async () => {
  const input = { filename: "avatar.webp", contentType: "image/webp", bytes: Buffer.from("fixture") };
  const original = await asUser(users[0], () => saveUserAvatar(input));
  const current = await asUser(users[0], () => saveUserAvatar(input));
  expect(await isActiveMediaKey(original.key!)).toBe(false);
  expect(await isActiveMediaKey(current.key!)).toBe(true);
  expect(await prisma.storageCleanup.findUnique({ where: { key: original.key! } })).not.toBeNull();
  const cover = await asUser(users[0], () => saveCoupleCover(input));
  await asUser(users[1], () => saveCoupleCover(null));
  expect(await isActiveMediaKey(cover.key!)).toBe(false);
  expect(await prisma.storageCleanup.findUnique({ where: { key: cover.key! } })).not.toBeNull();
});

it("a date removed during upload leaves only staged cleanup work", async () => {
  const item = await date();
  const original = storage.put.bind(storage);
  let completed = 0;
  vi.spyOn(storage, "put").mockImplementation(async (input) => {
    const result = await original(input);
    completed++;
    if (completed === 3) await asUser(users[1], () => deleteDatePlan(item.id));
    return result;
  });
  await expect(asUser(users[0], () => addDatePhoto(item.id, processed, "removed.webp"))).rejects.toMatchObject({ code: "not_found" });
  expect(await prisma.datePhoto.count({ where: { dateId: item.id } })).toBe(0);
  expect(await prisma.storageCleanup.count({ where: { key: { startsWith: `couples/${coupleId}/dates/${item.id}/` } } })).toBe(3);
});

it("a worker crash on the final allowed push attempt leaves an inspectable terminal failure", async () => {
  await setPushSubscription(users[0], subscription("final-lease"));
  const notification = await queue();
  await prisma.notificationDelivery.updateMany({
    where: { notificationId: notification.id }, data: { status: "PROCESSING", attempts: 6, leaseToken: "dead-worker", leaseUntil: new Date(Date.now() - 1_000) },
  });
  expect(await processNotificationDeliveries({ userId: users[0] })).toMatchObject({ failed: 1 });
  expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } })).status).toBe("FAILED");
  expect(transport.send).not.toHaveBeenCalled();
});
