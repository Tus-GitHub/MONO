import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/errors";

/** Identity is the original membership ID, never an email or display name. */
export async function eligibleArchivedPartner(coupleId: string, userId: string, tx: Prisma.TransactionClient = prisma) {
  const couple = await tx.couple.findFirst({ where: { id: coupleId, status: "ARCHIVED", deletedAt: null }, select: {
    id: true, timezone: true, currency: true, chatKeyId: true, chatGeneration: true,
    members: { select: { userId: true, user: { select: { deletedAt: true, blockedAt: true, emailVerified: true } } } },
  } });
  const member = couple?.members.find(row => row.userId === userId);
  const partner = couple?.members.find(row => row.userId !== userId);
  if (!couple || couple.members.length !== 2 || !member || member.user.deletedAt || member.user.blockedAt || !member.user.emailVerified || !partner?.user.deletedAt) throw new NotFoundError("This archived space is not available to this account.");
  return { coupleId: couple.id, userId, partnerId: partner.userId, memberIds: couple.members.map(row => row.userId), timezone: couple.timezone, currency: couple.currency, chatKeyId: couple.chatKeyId, chatGeneration: couple.chatGeneration };
}

export async function approvedArchivedPartner(coupleId: string, userId: string, tx: Prisma.TransactionClient = prisma) {
  const context = await eligibleArchivedPartner(coupleId, userId, tx);
  const approval = await tx.archiveAccessRequest.findUnique({ where: { coupleId_requesterId: { coupleId, requesterId: userId } }, select: { status: true } });
  if (approval?.status !== "APPROVED") throw new NotFoundError("Admin approval is required to view this archived space.");
  return context;
}

/** Read-only guard. Deliberately separate from every active-couple/write guard. */
export async function requireArchivedRead(coupleId: string) {
  const user = await requireUser();
  return approvedArchivedPartner(coupleId, user.id);
}

/** Only the avatar that was retained on the original partner, never personal files. */
export async function requireArchivedAvatar(ownerId: string, key: string) {
  const user = await requireUser();
  const owner = await prisma.user.findFirst({ where: { id: ownerId, avatarKey: key, deletedAt: { not: null } }, select: { id: true } });
  if (!owner) throw new NotFoundError();
  const approvals = await prisma.archiveAccessRequest.findMany({ where: { requesterId: user.id, status: "APPROVED", couple: { members: { some: { userId: ownerId } } } }, select: { coupleId: true } });
  for (const approval of approvals) {
    try { await approvedArchivedPartner(approval.coupleId, user.id); return; }
    catch (error) { if (!(error instanceof NotFoundError)) throw error; }
  }
  throw new NotFoundError();
}
