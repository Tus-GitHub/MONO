import "server-only";

import {
  CoupleMemberRole,
  CoupleMemberStatus,
  CoupleStatus,
  NotificationType,
} from "@prisma/client";

import { env } from "@/config/env";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { randomToken, sha256 } from "@/lib/utils/crypto";

/**
 * Two-person connection via a shareable link.
 *
 * The raw token is 24 random bytes, base64url — never a database id. Only its SHA-256 hash is
 * stored, so the database never holds anything that could be used to accept an invitation.
 * Links are single-use and expire (default 72h).
 */
const DEFAULT_TTL_HOURS = 72;
const MAX_TTL_HOURS = 24 * 14;
const MAX_MEMBERS = 2;

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export function invitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now = new Date(),
): InvitationState {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.revokedAt) return "revoked";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function invitationUrl(token: string): string {
  return new URL(`/invite/${token}`, env.APP_URL).toString();
}

/** Issue a fresh link, revoking any previous outstanding one (one live link per space). */
export async function createInvitation(
  coupleId: string,
  createdById: string,
  options: { email?: string; ttlHours?: number } = {},
) {
  const couple = await prisma.couple.findFirst({
    where: { id: coupleId, deletedAt: null },
    include: { members: { where: { status: CoupleMemberStatus.ACTIVE } } },
  });
  if (!couple) throw new NotFoundError("Couple not found.");
  if (couple.members.length >= MAX_MEMBERS) {
    throw new ConflictError("Your space is already full.");
  }

  await prisma.coupleInvitation.updateMany({
    where: { coupleId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = randomToken(24);
  const ttlHours = Math.min(Math.max(options.ttlHours ?? DEFAULT_TTL_HOURS, 1), MAX_TTL_HOURS);
  const invitation = await prisma.coupleInvitation.create({
    data: {
      coupleId,
      createdById,
      tokenHash: sha256(token),
      email: options.email?.trim().toLowerCase() || null,
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
    },
  });

  return { token, invitation, url: invitationUrl(token) };
}

export async function getInvitationByToken(token: string) {
  const invitation = await prisma.coupleInvitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      couple: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          members: {
            where: { status: CoupleMemberStatus.ACTIVE },
            select: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  if (!invitation) return null;
  return { invitation, state: invitationState(invitation) };
}

export async function acceptInvitation(token: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.coupleInvitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        couple: { include: { members: { where: { status: CoupleMemberStatus.ACTIVE } } } },
      },
    });
    if (!invitation) throw new NotFoundError("That invitation link is not valid.");

    const state = invitationState(invitation);
    if (state !== "pending") {
      throw new ValidationError(
        state === "accepted"
          ? "That invitation was already used."
          : state === "revoked"
            ? "That invitation was cancelled."
            : "That invitation has expired — ask your partner for a fresh link.",
      );
    }
    if (invitation.createdById === userId) {
      throw new ConflictError("You can't accept your own invitation.");
    }
    if (invitation.couple.deletedAt) throw new NotFoundError("That space no longer exists.");
    if (invitation.couple.members.length >= MAX_MEMBERS) {
      throw new ConflictError("That space is already full.");
    }
    if (invitation.couple.members.some((member) => member.userId === userId)) {
      throw new ConflictError("You're already in this space.");
    }

    const otherMembership = await tx.coupleMember.findFirst({
      where: {
        userId,
        status: CoupleMemberStatus.ACTIVE,
        couple: { deletedAt: null, status: { in: [CoupleStatus.PENDING, CoupleStatus.ACTIVE] } },
      },
      select: { id: true },
    });
    if (otherMembership) throw new ConflictError("You're already part of a couple space.");

    await tx.coupleMember.create({
      data: {
        coupleId: invitation.coupleId,
        userId,
        role: CoupleMemberRole.PARTNER,
        status: CoupleMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });
    await tx.couple.update({
      where: { id: invitation.coupleId },
      data: { status: CoupleStatus.ACTIVE },
    });
    await tx.coupleInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedById: userId },
    });
    await tx.notification.create({
      data: {
        coupleId: invitation.coupleId,
        userId: invitation.createdById,
        type: NotificationType.PARTNER_JOINED,
        title: "Your partner joined",
        body: "You're both connected now — set up your space together.",
      },
    });

    return tx.couple.findUniqueOrThrow({ where: { id: invitation.coupleId } });
  });
}

export async function getActiveInvitation(coupleId: string) {
  const row = await prisma.coupleInvitation.findFirst({
    where: { coupleId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return row ? { ...row, state: invitationState(row) } : null;
}

export async function revokeInvitation(id: string, coupleId: string) {
  const result = await prisma.coupleInvitation.updateMany({
    where: { id, coupleId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw new NotFoundError("Invitation not found.");
}
