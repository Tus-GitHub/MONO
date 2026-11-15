import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import { createDatabaseAdapter } from "@/lib/db/pg-adapter.mjs";
import { prisma } from "@/lib/db/prisma";
import { privateCrypto } from "@/lib/privacy/server";
import { PRIVATE_TEXT_PREFIX } from "@/lib/privacy/crypto";
import { migratePrivateFields, migratePrivateFiles } from "@/lib/privacy/migration";
import type { StorageDriver } from "@/lib/storage/types";
import { sha256 } from "@/lib/utils/crypto";
import { registerUser } from "@/server/services/auth-service";
import { completeEmailVerification } from "@/server/services/email-verification-service";
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn(), sendWelcomeEmail: vi.fn() }));

const raw = new PrismaClient({ adapter: createDatabaseAdapter(process.env.DATABASE_URL!), log: [] });
const ids: string[] = [], couples: string[] = [];
const fixture = () => ({ name: `Private ${randomUUID()}`, email: `private-${randomUUID()}@example.invalid` });
async function user(legacy = false) {
  const input = fixture(); const row = await (legacy ? raw : prisma).user.create({ data: input }); ids.push(row.id); return { ...input, id: row.id };
}
afterEach(async () => {
  await raw.couple.deleteMany({ where: { id: { in: couples.splice(0) } } });
  await raw.user.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(async () => { await raw.$disconnect(); await prisma.$disconnect(); });

it("keeps raw identities and nested content unreadable while application reads and exact lookups work", async () => {
  const owner = await user();
  const stored = await raw.user.findUniqueOrThrow({ where: { id: owner.id } });
  expect(stored.name).toMatch(new RegExp(`^${PRIVATE_TEXT_PREFIX}`));
  expect(stored.email).not.toContain(owner.email);
  expect((await prisma.user.findUniqueOrThrow({ where: { email: owner.email } })).name).toBe(owner.name);
  const couple = await prisma.couple.create({ data: { createdById: owner.id, inviteCode: randomUUID(), name: "Secret space",
    dates: { create: { createdById: owner.id, title: "Secret date", notes: "Secret note", activities: { create: { title: "Secret activity" } } } },
  }, include: { dates: { include: { activities: true } } } }); couples.push(couple.id);
  expect(couple.dates[0].activities[0].title).toBe("Secret activity");
  const snapshot = await raw.couple.findUniqueOrThrow({ where: { id: couple.id }, include: { dates: { include: { activities: true } } } });
  expect(JSON.stringify(snapshot, (_, value) => typeof value === "bigint" ? value.toString() : value)).not.toContain("Secret");
  await prisma.date.update({ where: { id: couple.dates[0].id }, data: { activities: { updateMany: { where: {}, data: { description: "Changed privately" } } } } });
  expect((await prisma.dateActivity.findFirstOrThrow({ where: { dateId: couple.dates[0].id } })).description).toBe("Changed privately");
  expect((await raw.dateActivity.findFirstOrThrow({ where: { dateId: couple.dates[0].id } })).description).not.toContain("Changed privately");
  await expect(prisma.$transaction(async (tx) => { await tx.user.update({ where: { id: owner.id }, data: { nickname: "Rollback" } }); throw new Error("rollback"); })).rejects.toThrow("rollback");
  expect((await raw.user.findUniqueOrThrow({ where: { id: owner.id } })).nickname).toBeNull();
});

it("reads legacy identities without allowing duplicate signup during migration", async () => {
  const owner = await user(true);
  expect((await prisma.user.findUniqueOrThrow({ where: { email: owner.email } })).name).toBe(owner.name);
  expect(await prisma.user.count({ where: { id: owner.id, email: { notIn: ["different@example.invalid"] } } })).toBe(1);
  expect(await prisma.user.count({ where: { id: owner.id, email: { not: owner.email } } })).toBe(0);
  await expect(registerUser({ email: owner.email, name: fixture().name, password: "Fixture-only-password!", confirmPassword: "Fixture-only-password!" })).rejects.toMatchObject({ fieldErrors: { email: expect.any(Array) } });
  expect(await raw.user.count({ where: { id: owner.id } })).toBe(1);
});

it.each([true, false])("verifies mixed legacy/encrypted mailbox records (legacy user: %s)", async (legacy) => {
  const owner = await user(legacy); const token = randomBytes(32).toString("base64url");
  await (legacy ? prisma : raw).emailVerificationToken.create({ data: { userId: owner.id, email: owner.email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60000) } });
  await completeEmailVerification(token);
  expect((await raw.user.findUniqueOrThrow({ where: { id: owner.id } })).emailVerified).toBeInstanceOf(Date);
});

it("migrates legacy private fields and lookup indexes resumably without changing dates or update timestamps", async () => {
  const owner = await user(true);
  const before = await raw.user.findUniqueOrThrow({ where: { id: owner.id } });
  const audit = await migratePrivateFields(raw, privateCrypto(), false);
  expect(audit.User.plaintextFields).toBeGreaterThanOrEqual(2);
  expect((await raw.user.findUniqueOrThrow({ where: { id: owner.id } })).email).toBe(owner.email);
  await migratePrivateFields(raw, privateCrypto(), true);
  const after = await raw.user.findUniqueOrThrow({ where: { id: owner.id } });
  expect(after.updatedAt).toEqual(before.updatedAt);
  expect(after.email).not.toContain(owner.email);
  expect(after.emailLookup).toBe(privateCrypto().lookup(owner.email, "identity:email"));
  expect((await prisma.user.findUniqueOrThrow({ where: { email: owner.email } })).name).toBe(owner.name);
  const again = await migratePrivateFields(raw, privateCrypto(), true);
  expect(Object.values(again).reduce((sum, entry) => sum + entry.changed + entry.plaintextFields, 0)).toBe(0);
});

it("encrypts and rekeys original, display, thumbnail and avatar files, retiring old copies", async () => {
  const owner = await user();
  const objects = new Map<string, Buffer>();
  const driver: StorageDriver = {
    name: "memory", publicUrl: (key) => `/media/${key}`,
    async put(input) { objects.set(input.key, Buffer.from(input.body)); return { key: input.key, url: this.publicUrl(input.key), size: input.body.length }; },
    async get(key) { return objects.get(key)!; }, async exists(key) { return objects.has(key); }, async delete(key) { objects.delete(key); },
  };
  const couple = await raw.couple.create({ data: { createdById: owner.id, inviteCode: randomUUID() } }); couples.push(couple.id);
  const date = await raw.date.create({ data: { coupleId: couple.id, createdById: owner.id, title: "Photo fixture" } });
  const base = `couples/${couple.id}/dates/${date.id}/photos/my-personal-filename`;
  const old = [`${base}.webp`, `${base}.display.webp`, `${base}.thumb.webp`, `users/${owner.id}/avatar/my-name.webp`];
  for (const key of old) objects.set(key, Buffer.from("synthetic private image"));
  await raw.user.update({ where: { id: owner.id }, data: { avatarKey: old[3], avatarUrl: driver.publicUrl(old[3]) } });
  const photo = await raw.datePhoto.create({ data: { dateId: date.id, uploadedById: owner.id, storageKey: old[0], displayKey: old[1], thumbKey: old[2], url: driver.publicUrl(old[0]) } });
  const result = await migratePrivateFiles(raw, driver, privateCrypto(), true);
  expect(result.changed).toBeGreaterThanOrEqual(4);
  expect(old.every((key) => !objects.has(key))).toBe(true);
  const updated = await raw.datePhoto.findUniqueOrThrow({ where: { id: photo.id } });
  for (const key of [updated.storageKey, updated.displayKey!, updated.thumbKey!]) {
    expect(key).not.toContain("my-personal-filename");
    expect(objects.get(key)!.includes(Buffer.from("synthetic private image"))).toBe(false);
    expect(privateCrypto().decryptFile(objects.get(key)!, key).toString()).toBe("synthetic private image");
  }
  const again = await migratePrivateFiles(raw, driver, privateCrypto(), true);
  expect(again.changed).toBe(0); expect(again.plaintextFiles).toBe(0);
});
