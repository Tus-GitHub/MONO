import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const mail = vi.hoisted(() => ({ verify: vi.fn(), welcome: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: mail.verify, sendWelcomeEmail: mail.welcome }));
import { prisma } from "@/lib/db/prisma";
import { sha256 } from "@/lib/utils/crypto";
import { beginEmailVerification, completeEmailVerification, sendRegistrationEmails } from "@/server/services/email-verification-service";

const users: string[] = [];
let user: { id: string; email: string };
beforeEach(async () => {
  vi.resetAllMocks();
  user = await prisma.user.create({ data: { name: "Email fixture", email: `verify-${randomUUID()}@example.invalid` }, select: { id: true, email: true } });
  users.push(user.id);
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect(); });

function token(call = 0) {
  const url = new URL(mail.verify.mock.calls[call][0].verifyUrl);
  expect(url.search).toBe("");
  return new URLSearchParams(url.hash.slice(1)).get("token")!;
}

it("stores only a 24-hour token hash and sends an explicit-confirmation fragment URL", async () => {
  await beginEmailVerification(user.email);
  const raw = token();
  const row = await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });
  expect(row.tokenHash).toBe(sha256(raw)); expect(row.tokenHash).not.toBe(raw);
  expect(row.email).toBe(user.email);
  expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(23 * 3_600_000);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBeNull();
});

it("confirms once, retires other links, and never creates a login session", async () => {
  await beginEmailVerification(user.email); const first = token();
  await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
  await beginEmailVerification(user.email); const second = token(1);
  await completeEmailVerification(first);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBeInstanceOf(Date);
  await expect(completeEmailVerification(first)).rejects.toThrow("already used");
  await expect(completeEmailVerification(second)).rejects.toThrow("already used");
  expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(0);
});

it("keeps earlier links usable after resend and shares the cooldown across concurrent requests", async () => {
  await Promise.all([beginEmailVerification(user.email), beginEmailVerification(user.email)]);
  expect(mail.verify).toHaveBeenCalledOnce();
  const original = token();
  await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
  await beginEmailVerification(user.email);
  expect(mail.verify).toHaveBeenCalledTimes(2);
  await completeEmailVerification(original);
});

it("rejects malformed, unknown and expired capabilities", async () => {
  await expect(completeEmailVerification("bad")).rejects.toThrow("invalid");
  await expect(completeEmailVerification("x".repeat(43))).rejects.toThrow("invalid");
  await beginEmailVerification(user.email); const raw = token();
  await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
  await expect(completeEmailVerification(raw)).rejects.toThrow("expired");
});

it("refuses deleted accounts and a token for a changed mailbox", async () => {
  await beginEmailVerification(user.email); const raw = token();
  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
  await expect(completeEmailVerification(raw)).rejects.toThrow("invalid");
  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, email: `changed-${randomUUID()}@example.invalid` } });
  await expect(completeEmailVerification(raw)).rejects.toThrow("invalid");
});

it("commits only one competing verification", async () => {
  await beginEmailVerification(user.email); const raw = token();
  const results = await Promise.allSettled([completeEmailVerification(raw), completeEmailVerification(raw)]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
});

it("bounds outstanding links without invalidating earlier unexpired emails", async () => {
  for (let index = 0; index < 6; index++) {
    await beginEmailVerification(user.email);
    await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
  }
  expect(mail.verify).toHaveBeenCalledTimes(5);
  expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(5);
  await completeEmailVerification(token());
});

it("sends neither new verification links for confirmed/deleted users nor for unknown addresses", async () => {
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  await beginEmailVerification(user.email);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: null, deletedAt: new Date() } });
  await beginEmailVerification(user.email); await beginEmailVerification("unknown@example.invalid");
  expect(mail.verify).not.toHaveBeenCalled();
});

it("does not let a welcome failure suppress verification or fail the account", async () => {
  mail.welcome.mockRejectedValue(new Error("SMTP unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await sendRegistrationEmails(user.id);
  expect(mail.verify).toHaveBeenCalledOnce();
  expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  log.mockRestore();
});

it("does not let a verification failure suppress welcome and permits a later retry", async () => {
  mail.verify.mockRejectedValueOnce(new Error("SMTP unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await sendRegistrationEmails(user.id);
  expect(mail.welcome).toHaveBeenCalledOnce();
  await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
  await beginEmailVerification(user.email);
  expect(mail.verify).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
