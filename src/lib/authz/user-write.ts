import "server-only";

import type { Prisma } from "@prisma/client";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/current-user";

/** Public service arguments must identify the caller, never another account. */
export async function requireSelf(userId: string): Promise<void> {
  if ((await requireUser()).id !== userId) throw new AuthorizationError();
}

/** Lock before creating account-owned capabilities or memberships; deletion uses the same lock. */
export async function lockLivingUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
  if (!user) throw new AuthenticationError();
}

/** Check mailbox ownership under the same lock as membership/account writes. */
export async function lockVerifiedUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const [user] = await tx.$queryRaw<{ emailVerified: Date | null }[]>`
    SELECT "emailVerified" FROM users WHERE id = ${userId} AND "deletedAt" IS NULL FOR UPDATE
  `;
  if (!user) throw new AuthenticationError();
  if (!user.emailVerified) {
    throw new AuthorizationError("Verify your email address before creating or joining a space. Your invitation will stay available while you check your inbox.");
  }
}
