import "server-only";

import { CoupleMemberRole, CoupleMemberStatus, CoupleStatus, NotificationType, Prisma } from "@prisma/client";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { generateInviteCode } from "@/lib/utils/crypto";
import type {
  CoupleSetupInput,
  CreateCoupleInput,
  JoinCoupleInput,
} from "@/lib/validation/couple";
import type { CoupleProfileInput } from "@/lib/validation/settings";
import { ensureDefaultReviewCategories } from "@/server/services/review-category-service";

const MAX_MEMBERS = 2;

async function assertUserHasNoActiveCouple(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const existing = await tx.coupleMember.findFirst({
    where: {
      userId,
      status: CoupleMemberStatus.ACTIVE,
      couple: { deletedAt: null, status: { in: [CoupleStatus.PENDING, CoupleStatus.ACTIVE] } },
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("You're already part of a couple space.");
  }
}

async function generateUniqueInviteCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode();
    const clash = await tx.couple.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new ConflictError("Could not allocate an invite code. Please try again.");
}

export async function createCoupleForUser(userId: string, input: CreateCoupleInput) {
  return prisma.$transaction(async (tx) => {
    await assertUserHasNoActiveCouple(tx, userId);

    const couple = await tx.couple.create({
      data: {
        name: input.name,
        anniversaryAt: input.anniversaryAt,
        timezone: input.timezone ?? "UTC",
        currency: input.currency ?? "USD",
        status: CoupleStatus.PENDING,
        inviteCode: await generateUniqueInviteCode(tx),
        createdById: userId,
        members: {
          create: {
            userId,
            role: CoupleMemberRole.OWNER,
            status: CoupleMemberStatus.ACTIVE,
            joinedAt: new Date(),
          },
        },
      },
    });

    await ensureDefaultReviewCategories(tx, couple.id);
    return couple;
  });
}

export async function joinCoupleByInviteCode(userId: string, input: JoinCoupleInput) {
  return prisma.$transaction(async (tx) => {
    await assertUserHasNoActiveCouple(tx, userId);

    const couple = await tx.couple.findFirst({
      where: { inviteCode: input.inviteCode, deletedAt: null },
      include: { members: { where: { status: CoupleMemberStatus.ACTIVE } } },
    });
    if (!couple) throw new NotFoundError("That invite code doesn't match a couple space.");
    if (couple.status === CoupleStatus.ARCHIVED) {
      throw new ConflictError("That couple space is no longer active.");
    }
    if (couple.members.length >= MAX_MEMBERS) {
      throw new ConflictError("That couple space is already full.");
    }
    if (couple.members.some((member) => member.userId === userId)) {
      throw new ConflictError("You're already in this couple space.");
    }

    await tx.coupleMember.create({
      data: {
        coupleId: couple.id,
        userId,
        role: CoupleMemberRole.PARTNER,
        status: CoupleMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    await tx.couple.update({
      where: { id: couple.id },
      data: { status: CoupleStatus.ACTIVE },
    });

    await tx.notification.create({
      data: {
        coupleId: couple.id,
        userId: couple.createdById,
        type: NotificationType.PARTNER_JOINED,
        title: "Your partner joined",
        body: "You're both connected now — start planning your first date.",
      },
    });

    return tx.couple.findUniqueOrThrow({ where: { id: couple.id } });
  });
}

/** Couple-setup step: save name, description, relationship date (photo handled by its route). */
export async function updateCoupleSetup(coupleId: string, input: CoupleSetupInput) {
  return prisma.couple.update({
    where: { id: coupleId },
    data: {
      name: input.name ?? null,
      description: input.description ?? null,
      anniversaryAt: input.anniversaryAt ?? null,
    },
  });
}

/** The couple profile fields the edit form needs. */
export async function getCoupleProfileForEdit(coupleId: string) {
  return prisma.couple.findUniqueOrThrow({
    where: { id: coupleId },
    select: {
      name: true,
      description: true,
      anniversaryAt: true,
      currency: true,
      photoUrl: true,
    },
  });
}

/** Settings: edit the couple's shared profile (photo is uploaded via its own route). */
export async function updateCoupleProfile(coupleId: string, input: CoupleProfileInput) {
  return prisma.couple.update({
    where: { id: coupleId },
    data: {
      name: input.name ?? null,
      description: input.description ?? null,
      anniversaryAt: input.anniversaryAt ?? null,
      currency: input.currency,
    },
    select: { id: true },
  });
}

/**
 * Archive the shared space and release both people. Nothing is hard-deleted — every date,
 * memory and photo is kept (soft) so the couple could be restored by support. After this both
 * users are free to start or join a new couple.
 */
export async function disconnectCouple(coupleId: string) {
  return prisma.$transaction(async (tx) => {
    const couple = await tx.couple.findFirst({
      where: { id: coupleId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!couple) throw new NotFoundError("That couple space no longer exists.");
    if (couple.status === CoupleStatus.ARCHIVED) {
      throw new ConflictError("This space is already archived.");
    }
    await tx.coupleMember.updateMany({
      where: { coupleId, status: CoupleMemberStatus.ACTIVE },
      data: { status: CoupleMemberStatus.LEFT },
    });
    await tx.couple.update({
      where: { id: coupleId },
      data: { status: CoupleStatus.ARCHIVED },
    });
  });
}

/** Idempotent — marks the couple space as set up. */
export async function markCoupleSetupComplete(coupleId: string) {
  await prisma.couple.updateMany({
    where: { id: coupleId, setupCompletedAt: null },
    data: { setupCompletedAt: new Date() },
  });
}

/** The couple plus both members' profiles — for the setup form and confirmation screen. */
export async function getCoupleWithMembers(coupleId: string) {
  return prisma.couple.findUniqueOrThrow({
    where: { id: coupleId },
    include: {
      members: {
        where: { status: CoupleMemberStatus.ACTIVE },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, nickname: true, pronouns: true, avatarUrl: true },
          },
        },
      },
    },
  });
}

/** Just the active members' display info — for shells, avatars, headers. */
export async function getCoupleMembersLite(coupleId: string) {
  const rows = await prisma.coupleMember.findMany({
    where: { coupleId, status: CoupleMemberStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return rows.map((row) => ({
    id: row.user.id,
    name: row.user.name,
    avatarUrl: row.user.avatarUrl,
  }));
}

/** Lightweight aggregates for the dashboard shell. */
export async function getCoupleOverview(coupleId: string) {
  const [members, dateCounts, memoryCount] = await Promise.all([
    prisma.coupleMember.findMany({
      where: { coupleId, status: CoupleMemberStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.date.groupBy({
      by: ["status"],
      where: { coupleId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.memory.count({ where: { coupleId, deletedAt: null } }),
  ]);

  return {
    members: members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
    })),
    datesByStatus: Object.fromEntries(
      dateCounts.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>,
    totalDates: dateCounts.reduce((sum, row) => sum + row._count._all, 0),
    memoryCount,
  };
}
