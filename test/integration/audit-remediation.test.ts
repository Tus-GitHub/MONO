import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { asUser, testUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return {
    requireUser: async () => {
      const id = testUser.getStore();
      if (!id) throw new Error("Missing test user context.");
      return prisma.user.findUniqueOrThrow({ where: { id } });
    },
  };
});

import { prisma } from "@/lib/db/prisma";
import { exportCoupleData } from "@/server/services/account-service";
import { getPlaceDetail, setDatePlannedPlace, clearDatePlannedPlace, setActivityPlace } from "@/server/services/place-service";
import { getPlaceHistoryMap, score10 } from "@/server/services/place-history";
import { saveReviewDraft, submitReview, reopenReview, deleteReview } from "@/server/services/review-service";
import { getDateDetail, getDateExperience, getUpcomingDates, transitionDate } from "@/server/services/date-service";
import { updateBasics, updateBudget, addActivity, updateActivity, deleteActivity, reorderActivities, cancelDate, finalizePlan } from "@/server/services/plan-service";
import { addDateExpense } from "@/server/services/expense-service";
import { getCoupleProfile } from "@/server/services/couple-insights-service";
import { promoteDueDates } from "@/server/services/calendar-service";

const suffix = randomUUID();
let users: string[] = [];
let coupleId: string;
let otherCoupleId: string;
let placeId: string;
let categoryId: string;

beforeAll(async () => {
  const created = await Promise.all([0, 1, 2, 3].map((n) => prisma.user.create({
    data: { email: `mono-fixture-${suffix}-${n}@example.invalid`, name: `Fixture ${n}` },
  })));
  users = created.map((user) => user.id);
  const couple = await prisma.couple.create({
    data: {
      createdById: users[0], inviteCode: `fixture-${suffix}`, status: "ACTIVE", timezone: "Asia/Kolkata", currency: "INR",
      members: {
        create: [
          { userId: users[0], role: "OWNER", status: "ACTIVE" },
          { userId: users[1], role: "PARTNER", status: "ACTIVE" },
        ]
      },
    },
  });
  coupleId = couple.id;
  otherCoupleId = (await prisma.couple.create({
    data: {
      createdById: users[2], inviteCode: `other-${suffix}`, status: "ACTIVE",
      members: {
        create: [
          { userId: users[2], role: "OWNER", status: "ACTIVE" },
          { userId: users[3], role: "PARTNER", status: "ACTIVE" },
        ]
      },
    }
  })).id;
  placeId = (await prisma.place.create({ data: { coupleId, createdById: users[0], name: "Fixture cafe", category: "CAFE" } })).id;
  categoryId = (await prisma.reviewCategory.create({ data: { coupleId, key: "fixture", label: "Fixture" } })).id;
});

afterAll(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [coupleId, otherCoupleId].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

async function newDate(status: "DRAFT" | "TODAY" | "COMPLETED" = "COMPLETED", withPlace = false) {
  return prisma.date.create({
    data: {
      coupleId, createdById: users[0], title: `Fixture ${randomUUID()}`, status, currency: "INR",
      completedAt: status === "COMPLETED" ? new Date() : null,
      plannedPlaceId: withPlace ? placeId : null,
    }
  });
}

function exportedDates(value: Awaited<ReturnType<typeof exportCoupleData>>) {
  return (value.couple as { dates: { id: string; reviews: { authorId: string; lovedText: string | null }[] }[] }).dates;
}

it("keeps partner drafts and unrevealed submissions out of exports and detail DTOs", async () => {
  const date = await newDate();
  await asUser(users[0], () => saveReviewDraft(date.id, { overallRating: 9, lovedText: "PRIVATE REFLECTION" }, {}));
  const before = await asUser(users[1], exportCoupleData);
  expect(exportedDates(before).find((d) => d.id === date.id)?.reviews).toEqual([]);
  expect(JSON.stringify(before)).not.toContain("PRIVATE REFLECTION");
  await asUser(users[0], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 9, lovedText: "PRIVATE REFLECTION" }, {}));
  expect((await asUser(users[1], () => getDateDetail(date.id))).reviews).toEqual([]);
  const mine = await asUser(users[0], exportCoupleData);
  expect(exportedDates(mine).find((d) => d.id === date.id)?.reviews).toHaveLength(1);
  await asUser(users[1], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 7 }, {}));
  expect(exportedDates(await asUser(users[1], exportCoupleData)).find((d) => d.id === date.id)?.reviews).toHaveLength(2);
});

it("only includes revealed dates in place averages while retaining visit counts", async () => {
  const date = await newDate("COMPLETED", true);
  await asUser(users[0], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 10 }, {}));
  expect(score10((await getPlaceHistoryMap(coupleId)).get(placeId))).toBeNull();
  const hidden = await asUser(users[1], () => getPlaceDetail(placeId));
  expect(hidden.history.visitCount).toBe(1);
  expect(hidden.history.coupleScore10).toBeNull();
  expect(hidden.history.dates[0].score10).toBeNull();
  await asUser(users[1], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 6 }, {}));
  expect((await asUser(users[1], () => getPlaceDetail(placeId))).history.coupleScore10).toBe(8);
});

const lockedEdits = [
  ["basics", (id: string, _act: string) => updateBasics(id, { title: "Overwritten" })],
  ["budget", (id: string, _act: string) => updateBudget(id, { split: "SHARED", currency: "USD" })],
  ["add activity", (id: string, _act: string) => addActivity(id, { title: "Extra" })],
  ["update activity", (id: string, act: string) => updateActivity(id, act, { title: "Changed" })],
  ["delete activity", (id: string, act: string) => deleteActivity(id, act)],
  ["reorder activities", (id: string, act: string) => reorderActivities(id, [act])],
  ["set place", (id: string, _act: string) => setDatePlannedPlace(id, { mode: "saved", savedPlaceId: placeId })],
  ["clear place", (id: string, _act: string) => clearDatePlannedPlace(id)],
  ["set activity place", (id: string, act: string) => setActivityPlace(id, act, placeId)],
] as const;

it.each(lockedEdits)("rejects locked plan mutation: %s", async (_label, edit) => {
  const date = await newDate("COMPLETED", true);
  const activity = await prisma.dateActivity.create({ data: { dateId: date.id, title: "Original" } });
  await expect(asUser(users[0], async () => { await edit(date.id, activity.id); })).rejects.toMatchObject({ code: "validation_error" });
  expect((await prisma.date.findUniqueOrThrow({ where: { id: date.id } })).version).toBe(0);
  expect((await prisma.dateActivity.findUniqueOrThrow({ where: { id: activity.id } })).title).toBe("Original");
});

it("rejects a competing stale form save without overwriting its winner", async () => {
  const date = await newDate("DRAFT");
  const results = await Promise.allSettled([
    asUser(users[0], () => updateBasics(date.id, { title: "First" }, 0)),
    asUser(users[1], () => updateBasics(date.id, { title: "Second" }, 0)),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "conflict" } });
  expect((await prisma.date.findUniqueOrThrow({ where: { id: date.id } })).version).toBe(1);
});

it("serializes activity insertion so concurrent additions have distinct positions", async () => {
  const date = await newDate("DRAFT");
  await Promise.all([
    asUser(users[0], () => addActivity(date.id, { title: "One" })),
    asUser(users[1], () => addActivity(date.id, { title: "Two" })),
  ]);
  const activities = await prisma.dateActivity.findMany({ where: { dateId: date.id }, orderBy: { sortOrder: "asc" } });
  expect(activities.map((activity) => activity.sortOrder)).toEqual([0, 1]);
});

it("concurrent submissions reveal once and lock all later changes", async () => {
  const date = await newDate();
  const results = await Promise.all([
    asUser(users[0], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 9 }, { [categoryId]: 9 })),
    asUser(users[1], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 7 }, { [categoryId]: 7 })),
  ]);
  expect(results.filter((result) => result.revealed)).toHaveLength(1);
  await expect(asUser(users[0], () => reopenReview(date.id))).rejects.toMatchObject({ code: "conflict" });
  await expect(asUser(users[1], () => deleteReview(date.id))).rejects.toMatchObject({ code: "conflict" });
  await expect(asUser(users[0], () => saveReviewDraft(date.id, { overallRating: 1 }, {}))).rejects.toMatchObject({ code: "conflict" });
  expect(await prisma.dateReview.count({ where: { dateId: date.id, submittedAt: { not: null } } })).toBe(2);
});

it("a reopen racing the partner submission cannot modify a revealed review", async () => {
  const date = await newDate();
  await asUser(users[0], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 9 }, {}));
  const results = await Promise.allSettled([
    asUser(users[0], () => reopenReview(date.id)),
    asUser(users[1], () => submitReview(date.id, { personalRevisit: "DEFINITELY", overallRating: 7 }, {})),
  ]);
  const mine = await prisma.dateReview.findUniqueOrThrow({ where: { dateId_authorId: { dateId: date.id, authorId: users[0] } } });
  expect(results[1].status).toBe("fulfilled");
  if (results[0].status === "fulfilled") expect(mine.submittedAt).toBeNull();
  else expect(results[0]).toMatchObject({ reason: { code: "conflict" } });
});

it("competing completion/cancellation cannot both commit from the same lifecycle state", async () => {
  const date = await newDate("TODAY");
  const results = await Promise.allSettled([
    asUser(users[0], () => transitionDate(date.id, { to: "COMPLETED" })),
    asUser(users[1], () => cancelDate(date.id)),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(["COMPLETED", "CANCELLED"]).toContain((await prisma.date.findUniqueOrThrow({ where: { id: date.id } })).status);
});

it("refuses a foreign couple's mutation and scopes exports to the authenticated couple", async () => {
  const date = await newDate("DRAFT");
  await expect(asUser(users[2], () => updateBasics(date.id, { title: "Foreign" }))).rejects.toMatchObject({ code: "not_found" });
  expect(exportedDates(await asUser(users[2], exportCoupleData))).toEqual([]);
  expect(testUser.getStore()).toBeUndefined();
});

it("PostgreSQL rejects invalid scores and negative expenses even without form validation", async () => {
  const date = await newDate();
  const review = await prisma.dateReview.create({ data: { dateId: date.id, authorId: users[0] } });
  await expect(prisma.dateReviewRating.create({ data: { reviewId: review.id, categoryId, score: 11 } })).rejects.toThrow();
  await expect(prisma.expense.create({ data: { coupleId, dateId: date.id, recordedById: users[0], description: "Invalid", amountCents: -1 } })).rejects.toThrow();
});

it("schedules reminders and countdowns from the local event time, without inventing a missing start time", async () => {
  const date = await newDate("DRAFT");
  await asUser(users[0], () => updateBasics(date.id, { title: "Timezone fixture", date: "2030-06-01", startTime: "19:00" }, 0));
  await asUser(users[0], () => finalizePlan(date.id));
  const reminders = await prisma.dateReminder.findMany({ where: { dateId: date.id, userId: users[0] } });
  expect(reminders.find((reminder) => reminder.kind === "UPCOMING")?.scheduledFor.toISOString()).toBe("2030-05-31T13:30:00.000Z");
  expect(reminders.find((reminder) => reminder.kind === "DATE_DAY")?.scheduledFor.toISOString()).toBe("2030-06-01T03:30:00.000Z");
  const upcoming = await asUser(users[1], getUpcomingDates);
  expect(upcoming.find((item) => item.id === date.id)?.countdownAt).toBe("2030-06-01T13:30:00.000Z");
  const untimed = await newDate("DRAFT");
  await asUser(users[0], () => updateBasics(untimed.id, { title: "Untimed", date: "2030-06-02" }, 0));
  expect((await prisma.date.findUniqueOrThrow({ where: { id: untimed.id } })).plannedStartAt).toBeNull();
});

it("uses the couple's day at the UTC/local midnight boundary", async () => {
  const date = await newDate("DRAFT");
  await prisma.date.update({ where: { id: date.id }, data: { status: "PLANNED", scheduledFor: new Date("2030-06-02T00:00:00Z") } });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-06-01T20:00:00Z")); // June 2 in Kolkata.
  try {
    await promoteDueDates(coupleId);
    expect((await prisma.date.findUniqueOrThrow({ where: { id: date.id } })).status).toBe("TODAY");
    const draft = await newDate("DRAFT");
    await expect(asUser(users[0], () => updateBasics(draft.id, { title: "Today", date: "2030-06-02" }, 0))).resolves.toBeUndefined();
    await expect(asUser(users[0], () => updateBasics(draft.id, { title: "Yesterday", date: "2030-06-01" }, 1))).rejects.toMatchObject({ code: "validation_error" });
  } finally { vi.useRealTimers(); }
});

it("keeps spending totals in their original currency and rejects mixed-currency date writes", async () => {
  const date = await newDate();
  const input = { description: "Fixture spend", amount: 10_000, category: "FOOD" as const, payer: "shared" as const };
  await expect(asUser(users[0], () => addDateExpense(date.id, { ...input, currency: "USD" }))).rejects.toMatchObject({ code: "validation_error" });
  await asUser(users[0], () => addDateExpense(date.id, { ...input, currency: "INR" }));
  const oldMixed = await prisma.expense.create({
    data: {
      coupleId, dateId: date.id, recordedById: users[0], description: "Legacy foreign currency", amountCents: 9_000, currency: "USD",
    }
  });
  const profile = await getCoupleProfile(coupleId, users[0]);
  expect(profile.statistics.totalSpendCents).toBe(10_000);
  expect(profile.statistics.currency).toBe("INR");
  const detail = await asUser(users[0], () => getDateExperience(date.id, users[0]));
  expect(detail.spending.totalCents).toBe(10_000);
  await prisma.couple.update({ where: { id: coupleId }, data: { currency: "USD" } });
  try {
    const changed = await getCoupleProfile(coupleId, users[0]);
    expect(changed.statistics.totalSpendCents).toBe(9_000);
    expect(changed.statistics.currency).toBe("USD");
  } finally {
    await prisma.couple.update({ where: { id: coupleId }, data: { currency: "INR" } });
    await prisma.expense.delete({ where: { id: oldMixed.id } });
  }
});

it("exports standalone active records and excludes a deleted memory attached to a date", async () => {
  const date = await newDate();
  await prisma.memory.create({ data: { coupleId, authorId: users[0], title: "Standalone", body: "Kept" } });
  await prisma.memory.create({ data: { coupleId, authorId: users[0], dateId: date.id, title: "Deleted fixture", body: "REMOVED MEMORY", deletedAt: new Date() } });
  const result = await asUser(users[0], exportCoupleData);
  expect(JSON.stringify(result)).toContain("Standalone");
  expect(JSON.stringify(result)).not.toContain("REMOVED MEMORY");
});

it("database membership constraints reject an active user in another space or a duplicate partner role", async () => {
  await expect(prisma.coupleMember.create({ data: { coupleId: otherCoupleId, userId: users[0], role: "PARTNER" } })).rejects.toThrow();
  await expect(prisma.coupleMember.update({ where: { coupleId_userId: { coupleId, userId: users[1] } }, data: { role: "OWNER" } })).rejects.toThrow();
});
