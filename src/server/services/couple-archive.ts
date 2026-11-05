import "server-only";

import type { Prisma } from "@prisma/client";

/** Internal transaction helper. Caller must authorize and lock the couple first. */
export async function archiveCoupleInTransaction(tx: Prisma.TransactionClient, coupleId: string, now: Date) {
  await tx.coupleMember.updateMany({ where: { coupleId, status: "ACTIVE" }, data: { status: "LEFT" } });
  await tx.couple.update({ where: { id: coupleId }, data: { status: "ARCHIVED", inviteCodeExpiresAt: now } });
  await tx.coupleInvitation.updateMany({
    where: { coupleId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now },
  });
  await tx.dateReminder.updateMany({
    where: { date: { coupleId }, dismissedAt: null }, data: { dismissedAt: now },
  });
  await tx.notificationDelivery.updateMany({
    where: { notification: { coupleId }, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "CANCELLED", leaseToken: null, leaseUntil: null, lastError: "space_archived" },
  });
}
