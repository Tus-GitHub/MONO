import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";

const context = vi.hoisted(() => ({ token: "" }));
vi.mock("@/lib/auth/session-cookie", () => ({ readSessionToken: async () => context.token }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { createAuthSession, resolveSessionUser } from "@/lib/auth/session-store";
import { signSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changeAccountPassword, listAuthSessions, revokeAuthSessions, revokeCurrentAuthSession } from "@/server/services/session-service";
import { completePasswordReset } from "@/server/services/auth-service";
import { sha256 } from "@/lib/utils/crypto";

const nonce = randomUUID();
let users: string[] = [];
let initialHash: string;
const password = "OriginalPassword123!";
const newPassword = "ChangedPassword123!";

beforeAll(async () => {
  initialHash = await hashPassword(password);
  users = (await Promise.all([0, 1].map((n) => prisma.user.create({ data: { email: `sessions-${nonce}-${n}@example.invalid`, name: "Session fixture", passwordHash: initialHash } })))).map((user) => user.id);
});
beforeEach(async () => {
  context.token = "";
  await prisma.authSession.deleteMany({ where: { userId: { in: users } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: users } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.updateMany({ where: { id: { in: users } }, data: { passwordHash: initialHash, tokenVersion: 0, deletedAt: null } });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

async function device(index = 0, remember = true) {
  const row = await createAuthSession({ userId: users[index], tokenVersion: 0 }, remember, "Mozilla/5.0 (Windows) Chrome/125.0 Safari/537.36");
  const payload = { userId: users[index], tokenVersion: 0, sessionId: row.id };
  return { row, payload, token: await signSession(payload, remember) };
}
async function push(id: string, authSessionId: string) {
  return prisma.pushSubscription.create({ data: { userId: id, authSessionId, endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`, data: {} } });
}

it("persists safe device metadata, remembers expiry choice and resolves only live sessions", async () => {
  const first = await device();
  const second = await device(0, false);
  context.token = first.token;
  const rows = await listAuthSessions();
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.id === first.row.id)).toMatchObject({ current: true, deviceLabel: "Chrome on Windows" });
  expect(first.row.expiresAt.getTime() - first.row.createdAt.getTime()).toBeGreaterThan(28 * 86_400_000);
  expect(second.row.expiresAt.getTime() - second.row.createdAt.getTime()).toBeLessThanOrEqual(86_401_000);
  expect(await resolveSessionUser(first.payload)).toMatchObject({ id: users[0] });
  expect(JSON.stringify(rows)).not.toContain("tokenVersion");
  await prisma.authSession.update({ where: { id: first.row.id }, data: { revokedAt: new Date() } });
  expect(await resolveSessionUser(first.payload)).toBeNull();
});

it("cannot list or revoke another person's session", async () => {
  const mine = await device();
  const other = await device(1);
  context.token = mine.token;
  expect(await listAuthSessions()).toHaveLength(1);
  await expect(revokeAuthSessions({ action: "revoke", sessionId: other.row.id })).rejects.toMatchObject({ httpStatus: 404 });
  expect(await resolveSessionUser(other.payload)).not.toBeNull();
});

it("revokes other devices and linked push subscriptions while keeping this device active", async () => {
  const first = await device();
  const second = await device();
  await push(users[0], first.row.id);
  await push(users[0], second.row.id);
  context.token = first.token;
  expect(await revokeAuthSessions({ action: "revoke-others" })).toEqual({ clearCookie: false });
  expect(await resolveSessionUser(first.payload)).not.toBeNull();
  expect(await resolveSessionUser(second.payload)).toBeNull();
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(1);
});

it("signs out all sessions and rejects credential snapshots from before revocation", async () => {
  const first = await device();
  const second = await device();
  context.token = first.token;
  expect(await revokeAuthSessions({ action: "revoke-all" })).toEqual({ clearCookie: true });
  expect(await resolveSessionUser(second.payload)).toBeNull();
  await expect(createAuthSession({ userId: users[0], tokenVersion: 0 }, true)).rejects.toMatchObject({ httpStatus: 401 });
  await expect(listAuthSessions()).rejects.toMatchObject({ httpStatus: 401 });
});

it("makes current-device logout idempotent and preserves another device", async () => {
  const first = await device();
  const second = await device();
  context.token = first.token;
  await revokeCurrentAuthSession();
  await revokeCurrentAuthSession();
  expect(await resolveSessionUser(first.payload)).toBeNull();
  expect(await resolveSessionUser(second.payload)).not.toBeNull();
});

it("changes the password atomically, revokes devices and removes reset and push capabilities", async () => {
  const first = await device();
  const second = await device();
  await push(users[0], first.row.id);
  await prisma.passwordResetToken.create({ data: { userId: users[0], tokenHash: sha256("old-reset"), expiresAt: new Date(Date.now() + 60_000) } });
  context.token = first.token;
  await changeAccountPassword({ currentPassword: password, password: newPassword, confirmPassword: newPassword });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
  expect(user.tokenVersion).toBe(1);
  expect(await verifyPassword(newPassword, user.passwordHash)).toBe(true);
  expect(await resolveSessionUser(first.payload)).toBeNull();
  expect(await resolveSessionUser(second.payload)).toBeNull();
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(0);
  expect(await prisma.passwordResetToken.count({ where: { userId: users[0] } })).toBe(0);
});

it("rejects wrong current passwords and OAuth-only accounts without changing sessions", async () => {
  const first = await device();
  context.token = first.token;
  await expect(changeAccountPassword({ currentPassword: "wrong", password: newPassword, confirmPassword: newPassword })).rejects.toMatchObject({ httpStatus: 401 });
  await prisma.user.update({ where: { id: users[0] }, data: { passwordHash: null } });
  await expect(changeAccountPassword({ currentPassword: password, password: newPassword, confirmPassword: newPassword })).rejects.toMatchObject({ httpStatus: 401 });
  expect(await resolveSessionUser(first.payload)).not.toBeNull();
});

it("bounds live devices and expires sessions independently of signed JWT expiry", async () => {
  const first = await device();
  await prisma.authSession.update({ where: { id: first.row.id }, data: { createdAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() - 1_000) } });
  expect(await resolveSessionUser(first.payload)).toBeNull();
  await Promise.all(Array.from({ length: 3 }, () => device()));
  for (let index = 0; index < 19; index++) await device();
  expect(await prisma.authSession.count({ where: { userId: users[0], revokedAt: null } })).toBe(20);
});

it("password reset revokes every session and cannot revive a deleted account", async () => {
  const first = await device();
  const raw = randomBytes(24).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: users[0], tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 60_000) } });
  await completePasswordReset({ token: raw, password: newPassword, confirmPassword: newPassword });
  expect(await resolveSessionUser(first.payload)).toBeNull();
  await prisma.user.update({ where: { id: users[0] }, data: { deletedAt: new Date() } });
  const rawDeleted = randomBytes(24).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: users[0], tokenHash: sha256(rawDeleted), expiresAt: new Date(Date.now() + 60_000) } });
  await expect(completePasswordReset({ token: rawDeleted, password: newPassword, confirmPassword: newPassword })).rejects.toMatchObject({ httpStatus: 422 });
  await expect(createAuthSession({ userId: users[0], tokenVersion: 1 }, true)).rejects.toMatchObject({ httpStatus: 401 });
});
