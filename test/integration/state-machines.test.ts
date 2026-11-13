import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});

import { prisma } from "@/lib/db/prisma";
import { addActualActivity, reorderActualActivities, seedActualsFromPlan } from "@/server/services/actuals-service";
import { recordActuals, transitionDate } from "@/server/services/date-service";
import { saveMemory, deleteMemory } from "@/server/services/memory-service";
import { saveRevisit } from "@/server/services/revisit-service";
import { finalizePlan } from "@/server/services/plan-service";
import { processStorageCleanup } from "@/server/services/storage-cleanup-service";
import { dispatchDueRemindersDetailed } from "@/server/services/reminder-service";
import { toggleCoupleFavorite } from "@/server/services/favorite-service";

const suffix = randomUUID();
let users: string[] = [];
let coupleId: string;

beforeAll(async () => {
  users = (await Promise.all([0, 1].map((number) => prisma.user.create({ data: {
    email: `state-${suffix}-${number}@example.invalid`, name: `State ${suffix} ${number}`,
  } })))).map((user) => user.id);
  coupleId = (await prisma.couple.create({ data: {
    createdById: users[0], inviteCode: suffix, status: "ACTIVE", timezone: "UTC",
    members: { create: users.map((userId, index) => ({ userId, role: index === 0 ? "OWNER" : "PARTNER" })) },
  } })).id;
});
afterAll(async () => {
  await prisma.storageCleanup.deleteMany({ where: { key: { startsWith: `couples/${coupleId}/` } } });
  await prisma.couple.deleteMany({ where: { id: coupleId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

const newDate = (status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS") => prisma.date.create({ data: {
  coupleId, createdById: users[0], title: "State regression", status,
  ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
} });

it("serializes competing seed operations so the actuals are copied exactly once", async () => {
  const date = await newDate();
  await prisma.dateActivity.create({ data: { dateId: date.id, title: "Dinner", kind: "PLANNED" } });
  const outcomes = await Promise.allSettled(users.map((user) => asUser(user, () => seedActualsFromPlan(date.id))));
  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.dateActivity.count({ where: { dateId: date.id, kind: "ACTUAL" } })).toBe(1);
});

it("preserves two simultaneous favourite toggles and refuses deleted content", async () => {
  const place = await prisma.place.create({ data: { coupleId, createdById: users[0], name: "Concurrent favourite" } });
  const results = await Promise.all(users.map((user) => asUser(user, () => toggleCoupleFavorite("place", place.id))));
  expect(results.sort()).toEqual([false, true]);
  const updated = await prisma.place.findUniqueOrThrow({ where: { id: place.id } });
  expect(updated.isFavorite).toBe(false);
  expect(Math.abs(Date.now() - updated.updatedAt.getTime())).toBeLessThan(10_000);
  await prisma.place.update({ where: { id: place.id }, data: { deletedAt: new Date() } });
  await expect(asUser(users[0], () => toggleCoupleFavorite("place", place.id))).rejects.toThrow();
});

it("serializes activity order allocation and refuses duplicate reorder identifiers", async () => {
  const date = await newDate();
  await Promise.all(users.map((user, index) => asUser(user, () => addActualActivity(date.id, { title: `Activity ${index}`, unplanned: false }))));
  const activities = await prisma.dateActivity.findMany({ where: { dateId: date.id, kind: "ACTUAL" }, orderBy: { sortOrder: "asc" } });
  expect(activities.map((activity) => activity.sortOrder)).toEqual([0, 1]);
  await expect(asUser(users[0], () => reorderActualActivities(date.id, [activities[0].id, activities[0].id]))).rejects.toThrow("ordering");
  expect((await prisma.dateActivity.findMany({ where: { dateId: date.id }, orderBy: { sortOrder: "asc" } })).map((activity) => activity.id)).toEqual(activities.map((activity) => activity.id));
});

it("checks every recording capability after cancellation inside its write transaction", async () => {
  const date = await newDate();
  await asUser(users[0], () => transitionDate(date.id, { to: "CANCELLED" }));
  await expect(asUser(users[0], () => addActualActivity(date.id, { title: "Late write", unplanned: false }))).rejects.toThrow();
  await expect(asUser(users[0], () => recordActuals(date.id, { actualNotes: "Late write" }))).rejects.toThrow();
  await expect(asUser(users[0], () => saveMemory(date.id, { title: "Late write", body: "Body", isFavorite: false }))).rejects.toThrow();
  await expect(asUser(users[0], () => saveRevisit(date.id, { choice: "YES" }))).rejects.toThrow();
  expect(await prisma.dateActivity.count({ where: { dateId: date.id } })).toBe(0);
  expect(await prisma.memory.count({ where: { dateId: date.id } })).toBe(0);
});

it("preserves the original start and clears completion when reopening", async () => {
  const date = await newDate("DRAFT");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  await prisma.date.update({ where: { id: date.id }, data: { scheduledFor: today } });
  await asUser(users[0], () => finalizePlan(date.id));
  const planned = await prisma.date.findUniqueOrThrow({ where: { id: date.id } });
  expect(planned.status).toBe("TODAY"); expect(planned.plannedAt).not.toBeNull();
  const started = await asUser(users[0], () => transitionDate(date.id, { to: "IN_PROGRESS" }));
  await asUser(users[0], () => transitionDate(date.id, { to: "COMPLETED" }));
  const reopened = await asUser(users[1], () => transitionDate(date.id, { to: "IN_PROGRESS" }));
  expect(reopened.startedAt).toEqual(started.startedAt);
  expect(reopened.startedById).toBe(users[0]); expect(reopened.completedAt).toBeNull();
});

it("reactivates a soft-deleted memory without duplicating it", async () => {
  const date = await newDate("COMPLETED");
  await asUser(users[0], () => saveMemory(date.id, { title: "First", body: "First body", isFavorite: false }));
  const first = await prisma.memory.findUniqueOrThrow({ where: { dateId: date.id } });
  await asUser(users[0], () => deleteMemory(date.id));
  await asUser(users[1], () => saveMemory(date.id, { title: "Second", body: "Second body", isFavorite: false }));
  const second = await prisma.memory.findUniqueOrThrow({ where: { dateId: date.id } });
  expect(second.id).toBe(first.id); expect(second.deletedAt).toBeNull(); expect(second.authorId).toBe(users[1]);
});

it("retires cleanup attempts exhausted without an active lease", async () => {
  const job = await prisma.storageCleanup.create({ data: { key: `couples/${coupleId}/exhausted.jpg`, attempts: 6 } });
  await processStorageCleanup();
  const failed = await prisma.storageCleanup.findUniqueOrThrow({ where: { id: job.id } });
  expect(failed.failedAt).not.toBeNull(); expect(failed.leaseToken).toBeNull();
});

it("does not claim an obsolete review reminder when the submission already exists", async () => {
  const date = await newDate("COMPLETED");
  await prisma.dateReview.create({ data: { dateId: date.id, authorId: users[0], overallRating: 8, submittedAt: new Date() } });
  const reminder = await prisma.dateReminder.create({ data: { dateId: date.id, userId: users[0], kind: "REVIEW", scheduledFor: new Date(Date.now() - 1000) } });
  const before = await prisma.notification.count({ where: { userId: users[0], entityId: date.id } });
  await dispatchDueRemindersDetailed(users[0]);
  expect(await prisma.notification.count({ where: { userId: users[0], entityId: date.id } })).toBe(before);
  expect((await prisma.dateReminder.findUniqueOrThrow({ where: { id: reminder.id } })).sentAt).toBeNull();
  expect((await prisma.dateReminder.findUniqueOrThrow({ where: { id: reminder.id } })).dismissedAt).not.toBeNull();
});
