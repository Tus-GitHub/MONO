import "server-only";

import { prisma } from "@/lib/db/prisma";
import { disconnectCouple } from "@/server/services/couple-service";

// ---------------------------------------------------------------------------
// Data export (part 6) — everything the couple has put in, as plain JSON.
// ---------------------------------------------------------------------------

export interface CoupleExport {
  exportedAt: string;
  format: "mono.couple.v1";
  couple: unknown;
}

export async function exportCoupleData(coupleId: string): Promise<CoupleExport> {
  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: coupleId },
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
            select: { title: true, body: true, occurredOn: true, isFavorite: true, createdAt: true },
          },
        },
      },
      reviewCategories: {
        select: { id: true, key: true, label: true, sortOrder: true, isActive: true },
      },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    format: "mono.couple.v1",
    couple,
  };
}

// ---------------------------------------------------------------------------
// Account deletion (part 6) — soft. Recoverable by support; sessions killed.
// ---------------------------------------------------------------------------

export async function deleteAccount(userId: string): Promise<void> {
  const memberships = await prisma.coupleMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: { coupleId: true },
  });

  // A two-person space can't function with one person gone — archive it (soft, keeps all data).
  for (const membership of memberships) {
    await disconnectCouple(membership.coupleId).catch(() => {
      /* already archived — fine */
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      // invalidate every existing session for this user
      tokenVersion: { increment: 1 },
    },
    select: { id: true },
  });
}
