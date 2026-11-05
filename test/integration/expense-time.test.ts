import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: async () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore() ?? "missing" } }) };
});
import { prisma } from "@/lib/db/prisma";
import { addDateExpense, updateDateExpense } from "@/server/services/expense-service";
import { getDateExperience } from "@/server/services/date-service";

let users: string[] = [], coupleId: string;
const instant = new Date("2026-11-05T12:15:47.123Z");
const input = { description: "Dinner", amount: 12550, category: "FOOD" as const, payer: "shared" as const };
beforeAll(async () => {
  const run = randomUUID();
  users = (await Promise.all([0, 1, 2].map((n) => prisma.user.create({ data: { email: `expense-time-${run}-${n}@example.invalid`, name: `Expense person ${n}` } })))).map((row) => row.id);
  coupleId = (await prisma.couple.create({ data: {
    createdById: users[0], inviteCode: run, status: "ACTIVE", timezone: "Asia/Kolkata", currency: "INR",
    members: { create: [{ userId: users[0], role: "OWNER" }, { userId: users[1], role: "PARTNER" }] },
  } })).id;
});
afterAll(async () => {
  await prisma.couple.deleteMany({ where: { id: coupleId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
async function fixture() {
  const date = await prisma.date.create({ data: { coupleId, createdById: users[0], title: "Expense time", status: "COMPLETED", currency: "INR", completedAt: new Date() } });
  const expenseId = await asUser(users[0], () => addDateExpense(date.id, { ...input, spentAt: instant }));
  return { date, expenseId };
}

it("stores a browser wall time as UTC and renders the editor in the couple timezone", async () => {
  const { date } = await fixture();
  const expenseId = await asUser(users[0], () => addDateExpense(date.id, { ...input, spentAtLocal: "2026-11-06T00:15" }));
  expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).spentAt.toISOString()).toBe("2026-11-05T18:45:00.000Z");
  const view = await asUser(users[1], () => getDateExperience(date.id, users[1]));
  expect(view.expenses.find((expense) => expense.id === expenseId)?.spentAtLocal).toBe("2026-11-06T00:15");
});
it("preserves the stored instant when an update omits the time", async () => {
  const { expenseId } = await fixture();
  await asUser(users[1], () => updateDateExpense(expenseId, { ...input, description: "Amount correction", amount: 13000 }));
  expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).spentAt).toEqual(instant);
});
it("retains seconds and milliseconds when the visible minute was not changed", async () => {
  const { expenseId } = await fixture();
  await asUser(users[1], () => updateDateExpense(expenseId, { ...input, spentAtLocal: "2026-11-05T17:45" }));
  expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).spentAt).toEqual(instant);
});
it("converts an explicitly changed local minute across the UTC day boundary", async () => {
  const { expenseId } = await fixture();
  await asUser(users[1], () => updateDateExpense(expenseId, { ...input, spentAtLocal: "2026-11-06T00:15" }));
  expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).spentAt.toISOString()).toBe("2026-11-05T18:45:00.000Z");
});
it("still accepts an explicit instant from a service caller", async () => {
  const { expenseId } = await fixture();
  const replacement = new Date("2026-11-06T03:01:02.345Z");
  await asUser(users[0], () => updateDateExpense(expenseId, { ...input, spentAt: replacement }));
  expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).spentAt).toEqual(replacement);
});
it("rolls back a rejected DST-gap edit instead of changing the amount or timestamp", async () => {
  const { expenseId } = await fixture();
  await prisma.couple.update({ where: { id: coupleId }, data: { timezone: "America/New_York" } });
  try {
    await expect(asUser(users[0], () => updateDateExpense(expenseId, { ...input, amount: 99999, spentAtLocal: "2026-03-08T02:30" }))).rejects.toMatchObject({ code: "validation_error" });
    expect(await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).toMatchObject({ amountCents: input.amount, spentAt: instant });
  } finally { await prisma.couple.update({ where: { id: coupleId }, data: { timezone: "Asia/Kolkata" } }); }
});
it("does not allow an unrelated account to edit the recorded instant", async () => {
  const { expenseId } = await fixture();
  await expect(asUser(users[2], () => updateDateExpense(expenseId, { ...input, spentAtLocal: "2026-11-06T00:15" }))).rejects.toMatchObject({ httpStatus: 409 });
  expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).spentAt).toEqual(instant);
});
