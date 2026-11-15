import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AuthenticationError } from "@/lib/errors";
import { privateCrypto } from "@/lib/privacy/server";

export const normalizeAccountEmail = (email: string) => email.trim().toLowerCase();
export const emailFingerprint = (email: string) => privateCrypto().lookup(normalizeAccountEmail(email), "identity:email");

/** Signup and moderation take the same lock, including when no account exists yet. */
export async function lockRegistrationEmail(tx: Prisma.TransactionClient, emailHash: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mono:email:${emailHash}`}, 0))::text`;
}

export async function assertEmailCanRegister(tx: Prisma.TransactionClient, rawEmail: string) {
  const email = normalizeAccountEmail(rawEmail);
  const emailHash = emailFingerprint(email);
  await lockRegistrationEmail(tx, emailHash);
  const [block, alias] = await Promise.all([
    tx.emailBlock.findUnique({ where: { emailHash }, select: { emailHash: true } }),
    tx.adminAccess.findUnique({ where: { loginAlias: email }, select: { userId: true } }),
  ]);
  if (block || alias) throw new AuthenticationError("This email cannot be used to create an account.");
  return { email, moderationEmailHash: emailHash };
}

/** An admin alias is only a sign-in name. Mail always uses the real account mailbox. */
export async function resolveLoginEmail(rawEmail: string): Promise<string> {
  const email = normalizeAccountEmail(rawEmail);
  const alias = await prisma.adminAccess.findUnique({ where: { loginAlias: email }, select: {
    user: { select: { email: true } },
  } });
  return alias?.user.email ?? email;
}
