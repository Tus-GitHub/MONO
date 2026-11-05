import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { readSessionToken } from "@/lib/auth/session-cookie";
import { verifySession, type SessionPayload } from "@/lib/auth/session";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { AuthenticationError, NotFoundError, ValidationError } from "@/lib/errors";

/** Uncached authorization for security mutations, independent of React's per-request cache. */
export async function assertAuthSession(tx: Prisma.TransactionClient, payload: SessionPayload) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${payload.userId} FOR UPDATE`;
  const session = await tx.authSession.findFirst({ where: {
    id: payload.sessionId, userId: payload.userId, tokenVersion: payload.tokenVersion,
    revokedAt: null, expiresAt: { gt: new Date() }, user: { deletedAt: null, tokenVersion: payload.tokenVersion },
  }, select: { id: true } });
  if (!session) throw new AuthenticationError("Sign in again to continue.");
}

export async function requireAuthSession(): Promise<SessionPayload> {
  const token = await readSessionToken();
  const payload = token ? await verifySession(token) : null;
  if (!payload) throw new AuthenticationError();
  await serializable((tx) => assertAuthSession(tx, payload));
  return payload;
}

export async function listAuthSessions() {
  const payload = await requireAuthSession();
  const rows = await prisma.authSession.findMany({
    where: { userId: payload.userId, tokenVersion: payload.tokenVersion, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }], take: 20,
    select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });
  return rows.map((row) => ({ ...row, current: row.id === payload.sessionId }));
}

export type RevokeSessionsInput = { action: "revoke"; sessionId: string } | { action: "revoke-others" | "revoke-all" };

export async function revokeAuthSessions(input: RevokeSessionsInput): Promise<{ clearCookie: boolean }> {
  const payload = await requireAuthSession();
  return serializable(async (tx) => {
    await assertAuthSession(tx, payload);
    const all = input.action === "revoke-all";
    const where: Prisma.AuthSessionWhereInput = {
      userId: payload.userId, revokedAt: null,
      ...(input.action === "revoke" ? { id: input.sessionId } : input.action === "revoke-others" ? { id: { not: payload.sessionId } } : {}),
    };
    const now = new Date();
    const devices = await tx.authSession.findMany({ where, select: { id: true } });
    const changed = await tx.authSession.updateMany({ where, data: { revokedAt: now } });
    if (input.action === "revoke" && changed.count === 0) throw new NotFoundError("That session could not be found.");
    if (devices.length) await tx.pushSubscription.deleteMany({ where: { userId: payload.userId, authSessionId: { in: devices.map((row) => row.id) } } });
    if (all) {
      await tx.user.update({ where: { id: payload.userId }, data: { tokenVersion: { increment: 1 } } });
      await tx.pushSubscription.deleteMany({ where: { userId: payload.userId } });
    }
    return { clearCookie: all || (input.action === "revoke" && input.sessionId === payload.sessionId) };
  });
}

/** Clear a session even if another request already revoked it; logout is idempotent. */
export async function revokeCurrentAuthSession(): Promise<void> {
  const token = await readSessionToken();
  const payload = token ? await verifySession(token) : null;
  if (!payload) return;
  await serializable(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${payload.userId} FOR UPDATE`;
    await tx.authSession.updateMany({ where: { id: payload.sessionId, userId: payload.userId, tokenVersion: payload.tokenVersion, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.pushSubscription.deleteMany({ where: { userId: payload.userId, authSessionId: payload.sessionId } });
  });
}

export async function changeAccountPassword(input: { currentPassword: string; password: string; confirmPassword: string }): Promise<void> {
  const valid = passwordSchema.safeParse(input.password);
  if (!valid.success || input.password !== input.confirmPassword) throw new ValidationError("Check the new password and its confirmation.");
  if (!input.currentPassword || input.currentPassword.length > 200) throw new ValidationError("Enter your current password.");
  const payload = await requireAuthSession();
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { passwordHash: true } });
  if (!await verifyPassword(input.currentPassword, user?.passwordHash)) throw new AuthenticationError("The current password is incorrect or this account uses Google sign-in.");
  const passwordHash = await hashPassword(input.password);
  await serializable(async (tx) => {
    await assertAuthSession(tx, payload);
    const fresh = await tx.user.findUnique({ where: { id: payload.userId }, select: { passwordHash: true } });
    if (!fresh || fresh.passwordHash !== user?.passwordHash) throw new AuthenticationError("Your password changed. Sign in again to continue.");
    await tx.user.update({ where: { id: payload.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    await tx.authSession.updateMany({ where: { userId: payload.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordResetToken.deleteMany({ where: { userId: payload.userId } });
    await tx.pushSubscription.deleteMany({ where: { userId: payload.userId } });
  });
}
