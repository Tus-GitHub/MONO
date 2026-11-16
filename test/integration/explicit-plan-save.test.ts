import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const provider = vi.hoisted(() => ({ name: "fixture", details: vi.fn() }));
vi.mock("@/lib/places", () => ({ getPlaceProviderByName: (name: string) => name === provider.name ? provider : null }));

import { prisma } from "@/lib/db/prisma";
import { emptyLocalPlan } from "@/lib/date/local-plan";
import { saveEditedPlan, saveNewPlan } from "@/server/services/new-plan-service";
import { firstCompletedDateId, getPlanTemplate } from "@/server/services/plan-template-service";
import { coupleRevision } from "@/server/services/couple-sync-service";
import { getPlan, updateBasics } from "@/server/services/plan-service";
import { transitionDate } from "@/server/services/date-service";
import { getMemoryContext, getMemoryHome, getMemoryTimeline, saveMemory } from "@/server/services/memory-service";
import { dateBasicsSchema } from "@/lib/validation/date";

let owner: string, partner: string, couple: string, outsider: string, otherCouple: string, foreignPlace: string;
beforeEach(async () => {
  provider.details.mockReset().mockResolvedValue(null);
  const run = randomUUID();
  const make = async (role: string) => {
    const user = await prisma.user.create({ data: { name: role, email: `${role}-${run}@example.invalid`, emailVerified: new Date() } });
    const space = await prisma.couple.create({ data: { createdById: user.id, inviteCode: `${role}-${run}`, members: { create: { userId: user.id, role: "OWNER", status: "ACTIVE" } } } });
    return { user: user.id, space: space.id };
  };
  const own = await make("explicit"); owner = own.user; couple = own.space;
  partner = (await prisma.user.create({ data: { name: "Partner", email: `partner-${run}@example.invalid`, emailVerified: new Date(), memberships: { create: { coupleId: couple, role: "PARTNER", status: "ACTIVE" } } } })).id;
  const other = await make("outsider"); outsider = other.user; otherCouple = other.space;
  foreignPlace = (await prisma.place.create({ data: { name: "Private venue", coupleId: otherCouple, createdById: outsider } })).id;
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider] } } });
});
afterAll(() => prisma.$disconnect());
const input = () => ({ ...emptyLocalPlan("INR", "Our night out"), key: randomUUID(), expectedTotal: "1500" });

it("atomically saves a staged place, budget and activities exactly once across concurrent retries", async () => {
  const plan = input();
  plan.expectedTotal = "1500";
  plan.category = "cafe";
  plan.place = { name: "Our custom café", selection: { mode: "custom", name: "Our custom café", category: "CAFE", city: "Noida" } };
  plan.activities = [{ key: "a", title: "Coffee", duration: "30", cost: "250", savedPlaceId: "" }];
  const results = await Promise.all([asUser(owner, () => saveNewPlan(plan, false)), asUser(owner, () => saveNewPlan(plan, false))]);
  expect(results[0].id).toBe(results[1].id);
  const saved = await prisma.date.findUniqueOrThrow({ where: { id: results[0].id }, include: { activities: true, events: true, plannedPlace: true } });
  expect(saved.status).toBe("DRAFT");
  expect(saved.expectedBudgetCents).toBe(150000);
  expect(saved.discoveryCategory).toBe("cafe");
  expect(saved.activities).toHaveLength(1);
  expect(saved.activities[0]).toMatchObject({ title: "Coffee", durationMinutes: 30, costCents: 25000 });
  expect(saved.events).toHaveLength(1);
  expect(saved.plannedPlace?.name).toBe("Our custom café");
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(1);
  expect(await prisma.place.count({ where: { coupleId: couple } })).toBe(1);
});
it("rejects another space's selected venue without creating a date", async () => {
  const plan = input(); plan.place = { name: "Forged preview", selection: { mode: "saved", savedPlaceId: foreignPlace } };
  await expect(asUser(owner, () => saveNewPlan(plan, false))).rejects.toThrow();
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(0);
});
it("rolls back a staged custom place when an activity links another space", async () => {
  const plan = input();
  plan.place = { name: "Should roll back", selection: { mode: "custom", name: "Should roll back", category: "OTHER" } };
  plan.activities = [{ key: "a", title: "Private activity", duration: "", cost: "", savedPlaceId: foreignPlace }];
  await expect(asUser(owner, () => saveNewPlan(plan, false))).rejects.toThrow();
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(0);
  expect(await prisma.place.count({ where: { coupleId: couple } })).toBe(0);
});
it("requires a title and valid future date before finalizing", async () => {
  const plan = input();
  await expect(asUser(owner, () => saveNewPlan(plan, true))).rejects.toThrow();
  plan.date = "2099-01-01"; plan.startTime = "19:00"; plan.endTime = "21:00";
  plan.activities = [{ key: "walk", title: "Walk", duration: "60", cost: "0", savedPlaceId: "", startTime: "19:00", endTime: "20:00" }];
  const result = await asUser(owner, () => saveNewPlan(plan, true));
  expect(result.status).toBe("PLANNED");
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(1);
});
it("does not create a draft or place when an external selection can no longer be verified", async () => {
  const plan = input(); plan.place = { name: "Social", selection: { mode: "external", provider: "fixture", providerPlaceId: "missing" } };
  await expect(asUser(owner, () => saveNewPlan(plan, false))).rejects.toThrow(/verify/);
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(0);
  expect(await prisma.place.count({ where: { coupleId: couple } })).toBe(0);
});
it("refuses to save for a member removed after the editor was opened", async () => {
  await prisma.coupleMember.updateMany({ where: { userId: owner }, data: { status: "LEFT" } });
  await expect(asUser(owner, () => saveNewPlan(input(), false))).rejects.toThrow();
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(0);
});

it("saves café and cinema as separate venue/time events, deduplicating the first venue", async () => {
  const plan = input(); Object.assign(plan, { date: "2099-01-01", startTime: "19:00", endTime: "23:00" });
  const cafe = { name: "Café", selection: { mode: "custom" as const, name: "Café", category: "CAFE" as const } };
  plan.place = cafe;
  plan.activities = [{ key: "cafe", title: "Coffee", savedPlaceId: "", duration: "60", cost: "200", place: cafe, startTime: "19:00", endTime: "20:00" },
    { key: "movie", title: "Movie", savedPlaceId: "", duration: "120", cost: "500", place: { name: "Cinema", selection: { mode: "custom", name: "Cinema", category: "CINEMA" } }, startTime: "21:00", endTime: "23:00" }];
  const saved = await asUser(owner, () => saveNewPlan(plan, true));
  const row = await prisma.date.findUniqueOrThrow({ where: { id: saved.id }, include: { activities: { orderBy: { sortOrder: "asc" }, include: { place: true } } } });
  expect(await prisma.place.count({ where: { coupleId: couple } })).toBe(2);
  expect(row.activities.map((stop) => stop.place?.name)).toEqual(["Café", "Cinema"]);
  expect(row.activities[0].placeId).toBe(row.plannedPlaceId);
  expect(row.activities[1].startAt?.toISOString()).toBe("2099-01-01T21:00:00.000Z");
  expect(row.activities[1].endAt?.toISOString()).toBe("2099-01-01T23:00:00.000Z");
  await asUser(owner, () => updateBasics(row.id, dateBasicsSchema.parse({ title: row.title, date: "2099-01-02", startTime: "19:00", endTime: "23:00" }), row.version));
  const moved = await prisma.dateActivity.findMany({ where: { dateId: row.id }, orderBy: { sortOrder: "asc" } });
  expect(moved[0].startAt?.toISOString()).toBe("2099-01-02T19:00:00.000Z");
  expect(moved[1].endAt?.toISOString()).toBe("2099-01-02T23:00:00.000Z");
});

it("recreates the first completed date with only schedule changes and no source mutation", async () => {
  const cafe = await prisma.place.create({ data: { coupleId: couple, createdById: owner, name: "First café" } });
  const source = await prisma.date.create({ data: { coupleId: couple, createdById: owner, title: "Our first date", notes: "Kept notes", status: "COMPLETED", currency: "INR",
    scheduledFor: new Date("2020-01-01"), plannedStartAt: new Date("2020-01-01T19:00:00Z"), plannedEndAt: new Date("2020-01-01T23:00:00Z"), plannedPlaceId: cafe.id, expectedBudgetCents: 120000,
    activities: { create: [{ title: "Coffee", kind: "PLANNED", sortOrder: 0, placeId: cafe.id, description: "Window table", startAt: new Date("2020-01-01T19:00:00Z"), endAt: new Date("2020-01-01T20:00:00Z") },
      { title: "Movie", kind: "PLANNED", sortOrder: 1, startAt: new Date("2020-01-01T21:00:00Z"), endAt: new Date("2020-01-01T23:00:00Z"), durationMinutes: 120 }] } } });
  await prisma.date.create({ data: { coupleId: couple, createdById: owner, title: "Older draft", status: "DRAFT", scheduledFor: new Date("2019-01-01") } });
  await prisma.date.create({ data: { coupleId: couple, createdById: owner, title: "Later completed", status: "COMPLETED", scheduledFor: new Date("2021-01-01") } });
  expect(await firstCompletedDateId(couple)).toBe(source.id);
  const count = await prisma.date.count({ where: { coupleId: couple } });
  const template = await asUser(owner, () => getPlanTemplate(source.id, true));
  expect(template).toMatchObject({ title: "Our first date", expectedTotal: "1200", notes: "Kept notes" });
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(count);
  const forged = { ...input(), date: "2099-01-02", startTime: "18:00", endTime: "22:00", title: "Tampered", notes: "Changed", activities: [] };
  const saved = await asUser(owner, () => saveNewPlan(forged, true, source.id));
  const row = await prisma.date.findUniqueOrThrow({ where: { id: saved.id }, include: { activities: { orderBy: { sortOrder: "asc" } } } });
  expect(row).toMatchObject({ title: source.title, notes: source.notes, plannedPlaceId: cafe.id, expectedBudgetCents: 120000 });
  expect(row.activities.map((stop) => stop.title)).toEqual(["Coffee", "Movie"]);
  expect(row.activities[0].description).toBe("Window table");
  expect(row.activities[1].startAt?.toISOString()).toBe("2099-01-02T20:00:00.000Z");
  expect(row.activities[1].endAt?.toISOString()).toBe("2099-01-02T22:00:00.000Z");
  expect(await prisma.date.findUnique({ where: { id: source.id } })).toEqual(source);
  expect(await asUser(owner, () => saveNewPlan(forged, true, source.id))).toEqual(saved);
});

it("rejects recreation of another couple's date and invalid event times without writing", async () => {
  const foreign = await prisma.date.create({ data: { coupleId: otherCouple, createdById: outsider, title: "Private", status: "COMPLETED" } });
  await expect(asUser(owner, () => getPlanTemplate(foreign.id, true))).rejects.toThrow();
  await expect(asUser(owner, () => saveNewPlan(input(), true, foreign.id))).rejects.toThrow();
  const plan = { ...input(), date: "2099-01-01", startTime: "19:00", endTime: "23:00", activities: [{ key: "a", title: "Movie", savedPlaceId: "", duration: "120", cost: "", startTime: "21:00", endTime: "20:00" }] };
  await expect(asUser(owner, () => saveNewPlan(plan, true))).rejects.toThrow();
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(0);
});

it("changes the partner revision after date status/version changes without returning records", async () => {
  const space = await prisma.couple.findUniqueOrThrow({ where: { id: couple } });
  const date = await prisma.date.create({ data: { coupleId: couple, createdById: owner, title: "Shared", status: "TODAY" } });
  const before = await coupleRevision(couple, space.updatedAt);
  expect(await coupleRevision(couple, space.updatedAt)).toBe(before);
  await prisma.date.update({ where: { id: date.id }, data: { status: "IN_PROGRESS", version: { increment: 1 } } });
  const after = await coupleRevision(couple, space.updatedAt);
  expect(after).not.toBe(before); expect(after).toMatch(/^[a-f0-9]{64}$/);
});

const completeInput = () => ({ ...input(), date: "2099-01-01", startTime: "17:00", endTime: "22:00", activities: [
  { key: "cafe", title: "Café", startTime: "17:00", endTime: "18:00", duration: "60", cost: "500", savedPlaceId: "" },
  { key: "movie", title: "Movie", startTime: "18:15", endTime: "20:15", duration: "120", cost: "800", savedPlaceId: "" },
] });
it("rejects overspending and events outside the fixed window at the server boundary", async () => {
  const plan = completeInput();
  plan.expectedTotal = "1000";
  await expect(asUser(owner, () => saveNewPlan(plan, true))).rejects.toThrow(/Check/);
  plan.expectedTotal = "1500"; plan.activities[1].endTime = "23:00";
  await expect(asUser(owner, () => saveNewPlan(plan, true))).rejects.toThrow(/Check/);
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(0);
});
it("lets both partners edit the same plan and refuses stale or foreign edits", async () => {
  const plan = completeInput();
  const saved = await asUser(owner, () => saveNewPlan(plan, true));
  const initial = await prisma.date.findUniqueOrThrow({ where: { id: saved.id } });
  const updated = { ...plan, title: "Our café and cinema evening", expectedTotal: "2000" };
  await asUser(partner, () => saveEditedPlan(updated, true, saved.id, initial.version));
  const row = await prisma.date.findUniqueOrThrow({ where: { id: saved.id }, include: { activities: true } });
  expect(row).toMatchObject({ title: updated.title, expectedBudgetCents: 200000, version: initial.version + 1, createdById: owner });
  expect(row.activities).toHaveLength(2);
  expect(row.plannedEndAt?.toISOString()).toBe("2099-01-01T22:00:00.000Z");
  await expect(asUser(owner, () => saveEditedPlan(plan, true, saved.id, initial.version))).rejects.toThrow(/partner changed/);
  await expect(asUser(outsider, () => saveEditedPlan(plan, true, saved.id, row.version))).rejects.toThrow();
  await asUser(owner, () => saveEditedPlan({ ...updated, notes: "Bring the tickets" }, true, saved.id, row.version));
  expect((await prisma.date.findUniqueOrThrow({ where: { id: saved.id } })).notes).toBe("Bring the tickets");
});
it("does not overwrite a started date or change currency once spending exists", async () => {
  const plan = completeInput();
  const saved = await asUser(owner, () => saveNewPlan(plan, true));
  const row = await prisma.date.findUniqueOrThrow({ where: { id: saved.id } });
  await prisma.expense.create({ data: { coupleId: couple, dateId: saved.id, recordedById: owner, description: "Tickets", amountCents: 80000, currency: "INR", paidBy: "SHARED", category: "OTHER" } });
  await expect(asUser(partner, () => saveEditedPlan({ ...plan, currency: "USD" }, true, saved.id, row.version))).rejects.toThrow(/original currency/);
  await prisma.date.update({ where: { id: saved.id }, data: { status: "IN_PROGRESS" } });
  await expect(asUser(owner, () => saveEditedPlan(plan, true, saved.id, row.version))).rejects.toThrow(/no longer be planned/);
});

it("keeps café then movie in one date through repeated draft saves, final save and both partners' Memories", async () => {
  const plan = completeInput();
  const cafe = { name: "Our café", selection: { mode: "custom" as const, name: "Our café", category: "CAFE" as const } };
  const movie = { name: "Our cinema", selection: { mode: "custom" as const, name: "Our cinema", category: "CINEMA" as const } };
  const first = { ...plan, place: cafe, activities: [{ ...plan.activities[0], place: cafe }] };
  const saved = await asUser(owner, () => saveNewPlan(first, false));
  const draft = await asUser(partner, () => getPlan(saved.id));
  expect(draft.activities.map((event) => event.placeName)).toEqual(["Our café"]);
  const both = { ...plan, place: cafe, split: "PARTNER" as const,
    activities: [{ ...plan.activities[0], place: cafe }, { ...plan.activities[1], place: movie }] };
  await asUser(partner, () => saveEditedPlan(both, false, saved.id, draft.version));
  const next = await asUser(owner, () => getPlan(saved.id));
  expect(next).toMatchObject({ status: "DRAFT", startTime: "17:00", endTime: "22:00", expectedTotalCents: 150000, budgetSplit: "PARTNER" });
  expect(next.activities.map((event) => [event.title, event.placeName, event.startTime, event.endTime])).toEqual([
    ["Café", "Our café", "17:00", "18:00"], ["Movie", "Our cinema", "18:15", "20:15"],
  ]);
  await asUser(owner, () => saveEditedPlan(both, true, saved.id, next.version));
  expect(await prisma.date.count({ where: { coupleId: couple } })).toBe(1);
  await asUser(owner, () => transitionDate(saved.id, { to: "IN_PROGRESS" }));
  await asUser(partner, () => transitionDate(saved.id, { to: "COMPLETED" }));
  const title = "Coffee, a movie and a whole evening of little moments together";
  await asUser(partner, () => saveMemory(saved.id, { title, body: "Both venues, one shared day.", isFavorite: true }));
  for (const user of [owner, partner]) {
    const home = await asUser(user, getMemoryHome);
    const timeline = await asUser(user, getMemoryTimeline);
    expect(home).toMatchObject({ totalCompleted: 1, memoriesKept: 1, favoriteMemories: 1 });
    expect(home.recentMemories[0]).toMatchObject({ id: saved.id, memoryTitle: title });
    expect(timeline.items[0]).toMatchObject({ id: saved.id, memoryTitle: title });
    expect((await asUser(user, () => getMemoryContext(saved.id))).memory?.title).toBe(title);
  }
  await asUser(owner, () => saveMemory(saved.id, { title: "Our day, kept", body: "Updated together", isFavorite: false }));
  expect((await asUser(partner, () => getMemoryContext(saved.id))).memory).toMatchObject({ title: "Our day, kept", body: "Updated together" });
});
