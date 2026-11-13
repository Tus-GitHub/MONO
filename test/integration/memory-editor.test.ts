import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: async () => {
    const id = testUser.getStore();
    if (!id) throw new Error("Missing test user.");
    return prisma.user.findUniqueOrThrow({ where: { id } });
  } };
});

import { prisma } from "@/lib/db/prisma";
import { deleteMemory, getMemoryContext, saveMemory } from "@/server/services/memory-service";

let users: string[] = [];
let coupleId: string;
let dateId: string;
beforeAll(async () => {
  const run = randomUUID();
  users = (await Promise.all([0, 1, 2].map((n) => prisma.user.create({ data: { email: `memory-editor-${run}-${n}@example.invalid`, name: `Memory fixture ${n}` } })))).map((row) => row.id);
  coupleId = (await prisma.couple.create({ data: {
    createdById: users[0], inviteCode: run, status: "ACTIVE",
    members: { create: [{ userId: users[0], role: "OWNER" }, { userId: users[1], role: "PARTNER" }] },
  } })).id;
  dateId = (await prisma.date.create({ data: { coupleId, createdById: users[0], title: "Memory fixture date", status: "COMPLETED", completedAt: new Date() } })).id;
});
afterAll(async () => {
  await prisma.couple.deleteMany({ where: { id: coupleId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

it("does not expose deleted memory text through the editor and permits an explicit new memory", async () => {
  await asUser(users[0], () => saveMemory(dateId, { title: "Removed memory", body: "Removed private body", isFavorite: true }));
  const original = await prisma.memory.findUniqueOrThrow({ where: { dateId } });
  await asUser(users[0], () => deleteMemory(dateId));
  expect((await asUser(users[0], () => getMemoryContext(dateId))).memory).toBeNull();
  expect((await asUser(users[1], () => getMemoryContext(dateId))).memory).toBeNull();
  expect(await prisma.memory.findUnique({ where: { id: original.id } })).toMatchObject({ body: "Removed private body", deletedAt: expect.any(Date) });
  await asUser(users[1], () => saveMemory(dateId, { title: "New memory", body: "Deliberately saved replacement", isFavorite: false }));
  expect(await prisma.memory.findUnique({ where: { dateId } })).toMatchObject({ id: original.id, title: "New memory", body: "Deliberately saved replacement", authorId: users[1], deletedAt: null });
  expect(await prisma.memory.count({ where: { dateId } })).toBe(1);
  expect((await asUser(users[1], () => getMemoryContext(dateId))).memory?.body).toBe("Deliberately saved replacement");
});

it("keeps the editor and replacement operation scoped to the caller's space", async () => {
  await expect(asUser(users[2], () => getMemoryContext(dateId))).rejects.toMatchObject({ httpStatus: 409 });
  await expect(asUser(users[2], () => saveMemory(dateId, { title: "Foreign", body: "Unwanted replacement", isFavorite: false }))).rejects.toMatchObject({ httpStatus: 409 });
  expect((await prisma.memory.findUniqueOrThrow({ where: { dateId } })).title).toBe("New memory");
});
