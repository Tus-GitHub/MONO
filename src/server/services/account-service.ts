import "server-only";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { requireCoupleContext } from "@/lib/authz";
import { reviewsForViewer } from "@/lib/date/review-reveal";
import { sharedPlaceRatings } from "@/lib/date/place-ratings";
import { serializable } from "@/lib/db/serializable";
import { requireSelf } from "@/lib/authz/user-write";
import { AuthenticationError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { archiveCoupleInTransaction } from "@/server/services/couple-archive";
import { emailFingerprint, lockRegistrationEmail } from "@/lib/auth/registration-policy";

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
              placeRatings: { select: { placeId: true, score: true } },
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

  const memberIds = couple.members.filter((member) => member.status === "ACTIVE").map((member) => member.user.id);
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
          memberIds,
        ).map((review) => ({
          ...review,
          placeRatings: review.placeRatings.filter((rating) => review.authorId === user.id || sharedPlaceRatings(date.reviews, memberIds, rating.placeId).length > 0),
        })),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Account deletion — retire access and email; retain the ID and saved history.
// ---------------------------------------------------------------------------

export async function deleteAccount(userId: string): Promise<void> {
  await requireSelf(userId);
  await serializable((tx) => deleteAccountInTransaction(tx, userId));
}

/** Internal transaction helper. Callers must authorise self-deletion or admin moderation. */
export async function deleteAccountInTransaction(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const identity = await tx.user.findUnique({ where: { id: userId }, select: { email: true, moderationEmailHash: true, deletedAt: true } });
    if (!identity) throw new AuthenticationError();
    if (identity.deletedAt) return;
    // Match signup/OAuth/moderation lock ordering before releasing the old mailbox.
    const emailHash = identity.moderationEmailHash ?? emailFingerprint(identity.email);
    await lockRegistrationEmail(tx, emailHash);
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
    if (!user) throw new AuthenticationError();
    if (user.deletedAt) return;
    const now = new Date();
    // Unpredictable so another signup cannot reserve a tombstone and prevent closure.
    const retiredEmail = `deleted-${randomUUID()}@accounts.invalid`;
    const memberships = await tx.coupleMember.findMany({
      where: { userId, status: "ACTIVE" }, orderBy: { coupleId: "asc" }, select: { coupleId: true },
    });
    for (const { coupleId } of memberships) {
      await tx.$queryRaw`SELECT id FROM couples WHERE id = ${coupleId} FOR UPDATE`;
      await archiveCoupleInTransaction(tx, coupleId, now);
    }
    // Retain record IDs, but retire credentials in the same commit as account access.
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.adminAccess.updateMany({ where: { userId }, data: { loginAlias: null } });
    const identities = await tx.account.findMany({ where: { userId }, select: { id: true } });
    for (const identity of identities) await tx.account.update({ where: { id: identity.id }, data: {
      providerAccountId: `mono:deleted:${identity.id}`, accessToken: null, refreshToken: null, idToken: null,
      tokenType: null, scope: null, expiresAt: null,
    } });
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.emailVerificationToken.updateMany({ where: { userId }, data: { email: retiredEmail } });
    await tx.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    const devices = await tx.pushSubscription.findMany({ where: { userId }, select: { id: true } });
    for (const device of devices) await tx.pushSubscription.update({ where: { id: device.id }, data: {
      endpoint: `https://retired.invalid/${device.id}`, data: {}, authSessionId: null,
    } });
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
      where: { id: userId }, data: {
        deletedAt: now, email: retiredEmail, emailVerified: null, moderationEmailHash: emailHash,
        name: "Deleted account", nickname: null, passwordHash: null, tokenVersion: { increment: 1 },
      },
    });
}
