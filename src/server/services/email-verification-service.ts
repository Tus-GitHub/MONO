import "server-only";

import { env } from "@/config/env";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";
import { ValidationError } from "@/lib/errors";
import { randomToken, sha256 } from "@/lib/utils/crypto";

const TOKEN_LIFETIME_MS = 24 * 60 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const INVALID_LINK = "This verification link is invalid, expired or already used. Request a new one below.";

/** A shared database cooldown applies across tabs, server instances and registration's after callback. */
export async function beginEmailVerification(email: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
  if (!user) return;
  const delivery = await serializable(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
    const current = await tx.user.findFirst({
      where: { id: user.id, email, deletedAt: null, emailVerified: null },
      select: { id: true, email: true, name: true },
    });
    if (!current) return null;
    const now = new Date();
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id, OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] } });
    const recent = await tx.emailVerificationToken.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) } }, select: { id: true } });
    if (recent || await tx.emailVerificationToken.count({ where: { userId: user.id } }) >= 5) return null;
    const raw = randomToken(32);
    await tx.emailVerificationToken.create({ data: {
      userId: current.id, email: current.email, tokenHash: sha256(raw), expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
    }, select: { id: true } });
    return { user: current, raw };
  });
  if (!delivery) return;
  // Use a fragment so the mailbox capability is absent from HTTP request URLs and access logs.
  const verifyUrl = new URL("/verify-email", env.APP_URL);
  verifyUrl.hash = `token=${delivery.raw}`;
  // Retain the token/cooldown on failure: SMTP acceptance can be uncertain after a timeout.
  await sendVerificationEmail({ to: delivery.user.email, name: delivery.user.name, verifyUrl: verifyUrl.toString() });
}

/** Called once after a successful registration; one provider failure does not suppress the other email. */
export async function sendRegistrationEmails(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { email: true, name: true } });
  if (!user) return;
  const outcomes = await Promise.allSettled([
    sendWelcomeEmail({ to: user.email, name: user.name, appUrl: new URL("/onboarding", env.APP_URL).toString() }),
    beginEmailVerification(user.email),
  ]);
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") console.error(`[email] Registration ${index === 0 ? "welcome" : "verification"} delivery failed; account remains available.`);
  });
}

/** An explicit POST consumes the capability. Merely opening/scanning an email link changes nothing. */
export async function completeEmailVerification(raw: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new ValidationError(INVALID_LINK);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: sha256(raw) }, select: { id: true, userId: true, email: true },
  });
  if (!record) throw new ValidationError(INVALID_LINK);
  await serializable(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${record.userId} FOR UPDATE`;
    const user = await tx.user.findFirst({ where: { id: record.userId, email: record.email, deletedAt: null }, select: { id: true } });
    if (!user) throw new ValidationError(INVALID_LINK);
    const now = new Date();
    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, userId: user.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new ValidationError(INVALID_LINK);
    await tx.user.update({ where: { id: user.id }, data: { emailVerified: now } });
    await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  });
}
