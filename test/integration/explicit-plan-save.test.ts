import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const provider = vi.hoisted(() => ({ name: "fixture", details: vi.fn() }));
vi.mock("@/lib/places", () => ({ getExternalPlaceProvider: () => provider }));

import { prisma } from "@/lib/db/prisma";
import { emptyLocalPlan } from "@/lib/date/local-plan";
import { saveNewPlan } from "@/server/services/new-plan-service";

let owner: string, couple: string, outsider: string, otherCouple: string, foreignPlace: string;
beforeEach(async () => {
  provider.details.mockReset().mockResolvedValue(null);
  const run = randomUUID();
  const make = async (role: string) => {
    const user = await prisma.user.create({ data: { name: role, email: `${role}-${run}@example.invalid`, emailVerified: new Date() } });
    const space = await prisma.couple.create({ data: { createdById: user.id, inviteCode: `${role}-${run}`, members: { create: { userId: user.id, role: "OWNER", status: "ACTIVE" } } } });
    return { user: user.id, space: space.id };
  };
  const own = await make("explicit"); owner = own.user; couple = own.space;
  const other = await make("outsider"); outsider = other.user; otherCouple = other.space;
  foreignPlace = (await prisma.place.create({ data: { name: "Private venue", coupleId: otherCouple, createdById: outsider } })).id;
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, outsider] } } });
});
afterAll(() => prisma.$disconnect());
const input = () => ({ ...emptyLocalPlan("INR", "Our night out"), key: randomUUID() });

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
  plan.date = "2099-01-01";
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
