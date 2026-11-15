import "server-only";

import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthorizationError } from "@/lib/errors";

export async function hasAdminAccess(userId: string): Promise<boolean> {
  return !!await prisma.adminAccess.findFirst({ where: {
    userId, user: { deletedAt: null, blockedAt: null, emailVerified: { not: null } },
  }, select: { userId: true } });
}

/** Every read and mutation checks a database-backed session AND the current grant. */
export async function requireAdmin(tx?: Prisma.TransactionClient) {
  const user = await requireUser();
  if (tx) await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
  const grant = await (tx ?? prisma).adminAccess.findFirst({ where: {
    userId: user.id, user: { deletedAt: null, blockedAt: null, emailVerified: { not: null } },
  }, select: { userId: true } });
  if (!grant) throw new AuthorizationError("Admin access requires a verified, authorised account.");
  return { id: user.id };
}
