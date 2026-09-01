import "server-only";

import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Fan a notification out to the other member(s) of a couple — used across the post-date
 * pipeline (review written, memory kept, expense added). Best-effort; never fails a mutation.
 */
export async function notifyPartner(params: {
  coupleId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  await fanOut(params, { includeActor: false });
}

/** Like `notifyPartner` but also notifies the actor — for shared moments (e.g. a review reveal). */
export async function notifyCouple(params: {
  coupleId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  await fanOut(params, { includeActor: true });
}

async function fanOut(
  params: {
    coupleId: string;
    actorId: string;
    type: NotificationType;
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
  },
  opts: { includeActor: boolean },
): Promise<void> {
  try {
    const members = await prisma.coupleMember.findMany({
      where: {
        coupleId: params.coupleId,
        status: "ACTIVE",
        ...(opts.includeActor ? {} : { userId: { not: params.actorId } }),
      },
      select: { userId: true },
    });
    if (members.length === 0) return;
    await prisma.notification.createMany({
      data: members.map((member) => ({
        coupleId: params.coupleId,
        userId: member.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      })),
    });
  } catch (error) {
    console.error("[notify] fan-out failed:", error);
  }
}

export async function listNotifications(userId: string, take = 40) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}
