import "server-only";

import { Prisma } from "@prisma/client";

import { env } from "@/config/env";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { sendPasswordResetEmail } from "@/lib/email";
import { AuthenticationError, ConflictError, ValidationError } from "@/lib/errors";
import { randomToken, sha256 } from "@/lib/utils/crypto";
import { assertNameAvailable, isNameConstraint, nameTakenError } from "@/server/services/name-service";
import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/lib/validation/auth";

const RESET_TOKEN_TTL_MINUTES = 30;

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  tokenVersion: number;
}

export async function registerUser(input: RegisterInput): Promise<AuthedUser> {
  await assertNameAvailable(input.name);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true, email: true, name: true, tokenVersion: true },
    });
    return user;
  } catch (error) {
    if (isNameConstraint(error)) throw nameTakenError();
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("An account with that email already exists.");
    }
    throw error;
  }
}

export async function authenticate(input: LoginInput): Promise<AuthedUser> {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, email: true, name: true, tokenVersion: true, passwordHash: true },
  });

  const ok = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !ok) {
    // One message for both cases — don't reveal whether the email exists.
    throw new AuthenticationError("Incorrect email or password.");
  }

  if (user.passwordHash && needsRehash(user.passwordHash)) {
    await prisma.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash, tokenVersion: user.tokenVersion, deletedAt: null },
      data: { passwordHash: await hashPassword(input.password) },
    });
  }

  return { id: user.id, email: user.email, name: user.name, tokenVersion: user.tokenVersion };
}

/**
 * Start password recovery. Always resolves without revealing whether the email is registered.
 */
export async function beginPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;

  const rawToken = randomToken(32);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

  const allowed = await serializable(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`;
    if (!await tx.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { id: true } })) return false;
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt } });
    return true;
  });
  if (!allowed) return;

  const resetUrl = new URL(`/reset-password?token=${rawToken}`, env.APP_URL).toString();
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
  });
}

/**
 * Finish password recovery: set the new password and invalidate every existing session by
 * bumping `tokenVersion`.
 */
export async function completePasswordReset(input: ResetPasswordInput): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(input.token) },
    include: { user: { select: { id: true, deletedAt: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || record.user.deletedAt) {
    throw new ValidationError("This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(input.password);

  await serializable(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${record.userId} FOR UPDATE`;
    if (!await tx.user.findFirst({ where: { id: record.userId, deletedAt: null }, select: { id: true } })) {
      throw new ValidationError("This reset link is invalid or has expired.");
    }
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ValidationError("This reset link is invalid or has expired.");
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
    });
    await tx.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.pushSubscription.deleteMany({ where: { userId: record.userId } });
  });
}
