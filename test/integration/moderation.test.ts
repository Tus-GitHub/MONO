import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  const { AuthenticationError } = await import("@/lib/errors");
  return { requireUser: async () => {
    const id = testUser.getStore();
    const user = id && await prisma.user.findFirst({ where: { id, deletedAt: null, blockedAt: null } });
    if (!user) throw new AuthenticationError();
    return user;
  } };
});
const emailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: emailMock }));

import { prisma } from "@/lib/db/prisma";
import { getAdminDashboard, getReportableAccounts, moderateAccount, reviewAccountReport, submitAccountReport } from "@/server/services/moderation-service";
import { authenticate, beginPasswordReset, registerUser } from "@/server/services/auth-service";
import { createAuthSession, resolveSessionUser } from "@/lib/auth/session-store";
import { upsertUserFromOAuthProfile } from "@/lib/auth/oauth/google";
import { emailFingerprint } from "@/lib/auth/registration-policy";
import { hasAdminAccess } from "@/lib/auth/admin";
import { hashPassword } from "@/lib/auth/password";
import { authenticateAdmin } from "@/server/services/admin-auth-service";

let ids: string[] = [];
let emails: string[] = [];
let coupleId: string;
let alias: string;
const password = "Disposable-Admin-QA-Only!";
const reason = "Reviewed the submitted report and account circumstances.";
const change = (action: "DELETE" | "BLOCK_EMAIL" | "UNBLOCK_EMAIL", index = 1) =>
  asUser(ids[0], () => moderateAccount({ action, targetId: ids[index], confirmation: ids[index], reason }));
const report = (index = 1) => ({ targetId: ids[index], category: "Harassment", details: "Please review this synthetic moderation fixture." });
const signup = (index = 1) => ({ email: emails[index], name: `New fixture ${randomUUID()}`, password, confirmPassword: password });

beforeEach(async () => {
  const key = randomUUID();
  const passwordHash = await hashPassword(password);
  emails = [0, 1, 2, 3].map((n) => `moderation-${key}-${n}@example.invalid`);
  ids = [];
  for (const [n, email] of emails.entries()) ids.push((await prisma.user.create({ data: {
    email, name: `Moderation fixture ${key} ${n}`, passwordHash, emailVerified: new Date(),
  } })).id);
  alias = `admin-${key}@example.invalid`;
  await prisma.adminAccess.create({ data: { userId: ids[0], loginAlias: alias } });
  coupleId = (await prisma.couple.create({ data: { createdById: ids[1], inviteCode: key, status: "ACTIVE",
    members: { create: [{ userId: ids[1], role: "OWNER" }, { userId: ids[2], role: "PARTNER" }] },
  } })).id;
  emailMock.mockClear();
});

afterEach(async () => {
  await prisma.moderationAudit.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.accountReport.deleteMany({ where: { reporterId: { in: ids } } });
  await prisma.emailBlock.deleteMany({ where: { accountId: { in: ids } } });
  await prisma.couple.deleteMany({ where: { id: coupleId } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});
afterAll(async () => { await prisma.$disconnect(); });

it("denies every admin service to unauthenticated users and ordinary accounts", async () => {
  await expect(getAdminDashboard()).rejects.toMatchObject({ httpStatus: 401 });
  await expect(asUser(ids[2], () => getAdminDashboard())).rejects.toMatchObject({ httpStatus: 403 });
  await expect(asUser(ids[2], () => moderateAccount({ action: "DELETE", targetId: ids[1], confirmation: ids[1], reason }))).rejects.toMatchObject({ httpStatus: 403 });
  await expect(asUser(ids[2], () => reviewAccountReport({ reportId: "invented", status: "DISMISSED", reason }))).rejects.toMatchObject({ httpStatus: 403 });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } })).deletedAt).toBeNull();
});

it("requires a verified current admin grant even for an already authenticated session", async () => {
  expect(await hasAdminAccess(ids[0])).toBe(true);
  await prisma.user.update({ where: { id: ids[0] }, data: { emailVerified: null } });
  await expect(asUser(ids[0], () => getAdminDashboard())).rejects.toMatchObject({ httpStatus: 403 });
  await prisma.user.update({ where: { id: ids[0] }, data: { emailVerified: new Date() } });
  await prisma.adminAccess.delete({ where: { userId: ids[0] } });
  await expect(change("DELETE")).rejects.toMatchObject({ httpStatus: 403 });
});

it("the dedicated admin sign-in rejects regular/unverified accounts and accepts either verified admin identifier", async () => {
  await expect(authenticateAdmin({ email: emails[1], password })).rejects.toMatchObject({ httpStatus: 401 });
  await prisma.user.update({ where: { id: ids[0] }, data: { emailVerified: null } });
  await expect(authenticateAdmin({ email: alias, password })).rejects.toMatchObject({ httpStatus: 403 });
  await prisma.user.update({ where: { id: ids[0] }, data: { emailVerified: new Date() } });
  expect((await authenticateAdmin({ email: alias, password })).id).toBe(ids[0]);
  expect((await authenticateAdmin({ email: emails[0], password })).id).toBe(ids[0]);
});

it("returns only account IDs and moderation state, with bounded pagination and accurate counts", async () => {
  const data = await asUser(ids[0], () => getAdminDashboard({ query: ids[1] }));
  expect(data.accountCount).toBe(1);
  expect(data.totalAccounts).toBe(await prisma.user.count());
  expect(data.accounts).toEqual([{ id: ids[1], deleted: false, blocked: false, admin: false }]);
  const json = JSON.stringify(data);
  for (const email of emails) expect(json).not.toContain(email);
  expect(json).not.toContain("passwordHash");
  expect(json).not.toContain("chatMessages");
  const beyond = await asUser(ids[0], () => getAdminDashboard({ page: 10000 }));
  expect(beyond.accounts).toEqual([]);
});

it("accepts a report only for a current/former partner and never automatically moderates", async () => {
  expect(await asUser(ids[2], getReportableAccounts)).toEqual([{ id: ids[1] }]);
  expect(await asUser(ids[3], getReportableAccounts)).toEqual([]);
  await expect(asUser(ids[3], () => submitAccountReport(report()))).rejects.toMatchObject({ httpStatus: 403 });
  await expect(asUser(ids[2], () => submitAccountReport(report(2)))).rejects.toMatchObject({ httpStatus: 403 });
  await prisma.coupleMember.updateMany({ where: { coupleId }, data: { status: "LEFT" } });
  const created = await asUser(ids[2], () => submitAccountReport(report()));
  expect((await prisma.accountReport.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("OPEN");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } });
  expect(target.deletedAt).toBeNull();
  expect(target.blockedAt).toBeNull();
  expect(await prisma.notification.count({ where: { userId: ids[1] } })).toBe(0);
});

it("serializes duplicate reports and enforces a durable daily report limit", async () => {
  const results = await Promise.allSettled([0, 1].map(() => asUser(ids[2], () => submitAccountReport(report()))));
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await prisma.accountReport.updateMany({ where: { reporterId: ids[2] }, data: { status: "DISMISSED" } });
  await prisma.accountReport.createMany({ data: Array.from({ length: 4 }, () => ({ ...report(), reporterId: ids[2], status: "DISMISSED" })) });
  await expect(asUser(ids[2], () => submitAccountReport(report()))).rejects.toMatchObject({ httpStatus: 409 });
});

it("requires confirmation and protects admin accounts from deletion and blocking", async () => {
  await expect(asUser(ids[0], () => moderateAccount({ action: "DELETE", targetId: ids[1], confirmation: ids[2], reason }))).rejects.toThrow();
  await expect(change("DELETE", 0)).rejects.toMatchObject({ httpStatus: 403 });
  await prisma.adminAccess.create({ data: { userId: ids[1] } });
  await expect(change("BLOCK_EMAIL")).rejects.toMatchObject({ httpStatus: 403 });
  expect(await prisma.moderationAudit.count({ where: { actorId: ids[0] } })).toBe(0);
});

it("blocks normalized email signup through credentials and Google, revokes sessions and reset links", async () => {
  const session = await createAuthSession({ userId: ids[1], tokenVersion: 0 }, true);
  const payload = { userId: ids[1], tokenVersion: 0, sessionId: session.id };
  expect(await resolveSessionUser(payload)).not.toBeNull();
  await prisma.passwordResetToken.create({ data: { userId: ids[1], tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) } });
  await change("BLOCK_EMAIL");
  expect(await resolveSessionUser(payload)).toBeNull();
  await expect(createAuthSession({ userId: ids[1], tokenVersion: 0 }, true)).rejects.toMatchObject({ httpStatus: 401 });
  expect(await prisma.passwordResetToken.count({ where: { userId: ids[1] } })).toBe(0);
  await expect(authenticate({ email: emails[1], password })).rejects.toMatchObject({ httpStatus: 401 });
  await expect(registerUser({ ...signup(), email: ` ${emails[1].toUpperCase()} ` })).rejects.toMatchObject({ httpStatus: 401 });
  await expect(upsertUserFromOAuthProfile({ email: emails[1], provider: "GOOGLE", providerAccountId: randomUUID(), name: "Blocked OAuth" })).rejects.toMatchObject({ httpStatus: 401 });
  await beginPasswordReset(emails[1]);
  expect(emailMock).not.toHaveBeenCalled();
  const block = await prisma.emailBlock.findUniqueOrThrow({ where: { emailHash: emailFingerprint(emails[1]) } });
  expect(JSON.stringify(block)).not.toContain(emails[1]);
});

it("keeps sign-in aliases out of public signup and sends alias recovery only to the actual mailbox", async () => {
  expect((await authenticate({ email: alias.toUpperCase(), password })).id).toBe(ids[0]);
  expect((await authenticate({ email: emails[0], password })).id).toBe(ids[0]);
  await expect(registerUser({ ...signup(), email: alias })).rejects.toMatchObject({ httpStatus: 401 });
  await expect(upsertUserFromOAuthProfile({ email: alias, provider: "GOOGLE", providerAccountId: randomUUID(), name: "Alias OAuth" })).rejects.toMatchObject({ httpStatus: 401 });
  await beginPasswordReset(alias);
  expect(emailMock).toHaveBeenCalledOnce();
  expect(emailMock.mock.calls[0][0].to).toBe(emails[0]);
});

it("unblocking allows a fresh session but never revives revoked sessions", async () => {
  const session = await createAuthSession({ userId: ids[1], tokenVersion: 0 }, true);
  await change("BLOCK_EMAIL");
  await change("UNBLOCK_EMAIL");
  expect(await resolveSessionUser({ userId: ids[1], tokenVersion: 0, sessionId: session.id })).toBeNull();
  const current = await authenticate({ email: emails[1], password });
  const fresh = await createAuthSession({ userId: current.id, tokenVersion: current.tokenVersion }, true);
  expect(await resolveSessionUser({ userId: current.id, tokenVersion: current.tokenVersion, sessionId: fresh.id })).not.toBeNull();
});

it("admin deletion archives the shared space, preserves the partner and allows signup until email is blocked", async () => {
  await change("DELETE");
  const deleted = await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } });
  expect(deleted.deletedAt).not.toBeNull();
  expect(deleted.email).not.toBe(emails[1]);
  expect(deleted.passwordHash).toBeNull();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: ids[2] } })).deletedAt).toBeNull();
  expect((await prisma.couple.findUniqueOrThrow({ where: { id: coupleId } })).status).toBe("ARCHIVED");
  const newAccount = await registerUser(signup()); ids.push(newAccount.id);
  await change("BLOCK_EMAIL");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: newAccount.id } })).blockedAt).not.toBeNull();
  await expect(registerUser(signup())).rejects.toMatchObject({ httpStatus: 401 });
  await change("UNBLOCK_EMAIL");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } })).deletedAt).not.toBeNull();
});

it("keeps an email blocked after deletion", async () => {
  await change("BLOCK_EMAIL");
  await change("DELETE");
  await expect(registerUser(signup())).rejects.toMatchObject({ httpStatus: 401 });
  await change("UNBLOCK_EMAIL");
  const created = await registerUser(signup()); ids.push(created.id);
  expect(created.id).not.toBe(ids[1]);
});

it("coordinates registration racing a block after deletion", async () => {
  await change("DELETE");
  const [registration, block] = await Promise.allSettled([registerUser(signup()), change("BLOCK_EMAIL")]);
  if (registration.status === "fulfilled") ids.push(registration.value.id);
  expect(block.status).toBe("fulfilled");
  expect(await prisma.user.count({ where: { email: emails[1], deletedAt: null, blockedAt: null } })).toBe(0);
  await expect(registerUser(signup())).rejects.toMatchObject({ httpStatus: 401 });
});

it("records manual reviews and refuses a false action-taken outcome", async () => {
  const created = await asUser(ids[2], () => submitAccountReport(report()));
  const review = { reportId: created.id, status: "ACTIONED", reason };
  await expect(asUser(ids[0], () => reviewAccountReport(review))).rejects.toMatchObject({ httpStatus: 409 });
  await change("BLOCK_EMAIL");
  await asUser(ids[0], () => reviewAccountReport(review));
  expect((await prisma.accountReport.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("ACTIONED");
  await expect(asUser(ids[0], () => reviewAccountReport(review))).rejects.toMatchObject({ httpStatus: 409 });
  expect(await prisma.moderationAudit.count({ where: { actorId: ids[0], targetId: ids[1] } })).toBe(2);
});

it("rolls back a block and audit record if account revocation fails", async () => {
  await prisma.user.update({ where: { id: ids[1] }, data: { tokenVersion: 2147483647 } });
  await expect(change("BLOCK_EMAIL")).rejects.toThrow();
  expect(await prisma.emailBlock.count({ where: { accountId: ids[1] } })).toBe(0);
  expect(await prisma.moderationAudit.count({ where: { actorId: ids[0] } })).toBe(0);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } })).blockedAt).toBeNull();
});
