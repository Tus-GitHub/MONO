import "server-only";

import { prisma } from "@/lib/db/prisma";
import { requireCoupleContext } from "@/lib/authz";
import { reviewsForViewer } from "@/lib/date/review-reveal";
import { serializable } from "@/lib/db/serializable";
import { requireSelf } from "@/lib/authz/user-write";
import { AuthenticationError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { archiveCoupleInTransaction } from "@/server/services/couple-archive";

// ---------------------------------------------------------------------------
// Data export (part 6) — everything the couple has put in, as plain JSON.
// ---------------------------------------------------------------------------

export interface CoupleExport {
  exportedAt: string;
  format: "mono.couple.v1";
  couple: unknown;
}

export async function exportCoupleData(): Promise<CoupleExport> {
  const { couple: authorizedCouple, user } = await requireCoupleContext();
  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: authorizedCouple.id },
    select: {
      id: true,
      name: true,
      description: true,
      anniversaryAt: true,
      currency: true,
      timezone: true,
      createdAt: true,
      members: {
        select: {
          role: true,
          status: true,
          joinedAt: true,
          user: {
            select: { id: true, name: true, nickname: true, pronouns: true, email: true },
          },
        },
      },
      places: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          category: true,
          address: true,
          city: true,
          isFavorite: true,
          createdAt: true,
        },
      },
      dates: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          notes: true,
          scheduledFor: true,
          plannedStartAt: true,
          plannedEndAt: true,
          expectedBudgetCents: true,
          expectedBudgetMinCents: true,
          expectedBudgetMaxCents: true,
          budgetSplit: true,
          actualStartAt: true,
          actualEndAt: true,
          actualLocationText: true,
          actualNotes: true,
          actualSpendCents: true,
          currency: true,
          completedAt: true,
          createdAt: true,
          plannedPlace: { select: { name: true, city: true } },
          actualPlace: { select: { name: true, city: true } },
          activities: {
            orderBy: { sortOrder: "asc" },
            select: {
              title: true,
              kind: true,
              unplanned: true,
              costCents: true,
              description: true,
            },
          },
          photos: {
            where: { deletedAt: null },
            select: { caption: true, isFavorite: true, takenAt: true, url: true },
          },
          reviews: {
            select: {
              authorId: true,
              overallRating: true,
              submittedAt: true,
              lovedText: true,
              betterText: true,
              rememberText: true,
              unexpectedText: true,
              personalRevisit: true,
              personalRevisitNote: true,
              ratings: { select: { categoryId: true, score: true, note: true } },
            },
          },
          revisitDecision: { select: { choice: true, reason: true, targetTimeframe: true } },
          expenses: {
            where: { deletedAt: null },
            orderBy: { spentAt: "asc" },
            select: {
              description: true,
              amountCents: true,
              currency: true,
              category: true,
              paidBy: true,
              ownerShareCents: true,
              note: true,
              spentAt: true,
            },
          },
          memory: {
            where: { deletedAt: null },
            select: { title: true, body: true, occurredOn: true, isFavorite: true, createdAt: true },
          },
        },
      },
      reviewCategories: {
        select: { id: true, key: true, label: true, sortOrder: true, isActive: true },
      },
      memories: { where: { deletedAt: null, dateId: null } },
      expenses: { where: { deletedAt: null, dateId: null } },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    format: "mono.couple.v1",
    couple: {
      ...couple,
      dates: couple.dates.map((date) => ({
        ...date,
        reviews: reviewsForViewer(
          date.reviews,
          user.id,
          couple.members.filter((member) => member.status === "ACTIVE").map((member) => member.user.id),
        ),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Account deletion (part 6) — soft. Recoverable by support; sessions killed.
// ---------------------------------------------------------------------------

export async function deleteAccount(userId: string): Promise<void> {
  await requireSelf(userId);
  await serializable(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
    if (!user) throw new AuthenticationError();
    if (user.deletedAt) return;
    const now = new Date();
    const memberships = await tx.coupleMember.findMany({
      where: { userId, status: "ACTIVE" }, orderBy: { coupleId: "asc" }, select: { coupleId: true },
    });
    for (const { coupleId } of memberships) {
      await tx.$queryRaw`SELECT id FROM couples WHERE id = ${coupleId} FOR UPDATE`;
      await archiveCoupleInTransaction(tx, coupleId, now);
    }
    // Credentials and delivery capabilities disappear in the same commit as access.
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.notificationPreference.updateMany({
      where: { userId }, data: { pushEnabled: false, pushSubscription: Prisma.DbNull },
    });
    await tx.dateReminder.updateMany({ where: { userId, dismissedAt: null }, data: { dismissedAt: now } });
    await tx.notificationDelivery.updateMany({
      where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED", leaseToken: null, leaseUntil: null, lastError: "account_deleted" },
    });
    await tx.coupleInvitation.updateMany({
      where: { createdById: userId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now },
    });
    await tx.user.update({
      where: { id: userId }, data: { deletedAt: now, passwordHash: null, tokenVersion: { increment: 1 } },
    });
  });
}
