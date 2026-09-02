import "server-only";

import { NotificationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { NOTIFICATION_CATEGORY_OF } from "@/lib/notifications/types";
import type { NotificationCategory } from "@/lib/notifications/prefs";

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

interface FanParams {
  coupleId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Fan a notification out to the other member(s) of a couple. Used across the post-date pipeline
 * (review submitted, memory kept, expense added, plan edited). Best-effort — never fails a
 * mutation. Respects each recipient's category preference and collapses duplicates.
 */
export async function notifyPartner(params: FanParams): Promise<void> {
  await fanOut(params, { includeActor: false });
}

/** Like `notifyPartner` but also notifies the actor — for shared moments (e.g. a review reveal). */
export async function notifyCouple(params: FanParams): Promise<void> {
  await fanOut(params, { includeActor: true });
}

/** How long the same (type, entity) notification is suppressed for one user. */
function dedupeWindowMs(type: NotificationType): number {
  if (type === NotificationType.DATE_EDITED) return 60 * 60_000; // collapse an edit flurry
  return 10 * 60_000;
}

async function recipientsAllowing(
  userIds: string[],
  category: NotificationCategory | null,
): Promise<Set<string>> {
  if (!category || userIds.length === 0) return new Set(userIds);
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, upcomingDate: true, dateDay: true, reviewReminder: true, memoryReminder: true, unfinishedPlan: true, partnerEdits: true },
  });
  const byUser = new Map(prefs.map((p) => [p.userId, p]));
  return new Set(
    userIds.filter((id) => {
      const p = byUser.get(id);
      return p ? p[category] !== false : true; // no row = defaults, all on
    }),
  );
}

async function fanOut(params: FanParams, opts: { includeActor: boolean }): Promise<void> {
  try {
    const members = await prisma.coupleMember.findMany({
      where: {
        coupleId: params.coupleId,
        status: "ACTIVE",
        ...(opts.includeActor ? {} : { userId: { not: params.actorId } }),
      },
      select: { userId: true },
    });
    let targets = members.map((m) => m.userId);
    if (targets.length === 0) return;

    // 1) preference gate
    targets = [...(await recipientsAllowing(targets, NOTIFICATION_CATEGORY_OF[params.type]))];
    if (targets.length === 0) return;

    // 2) de-duplicate against a recent identical notification
    const since = new Date(Date.now() - dedupeWindowMs(params.type));
    const recent = await prisma.notification.findMany({
      where: {
        userId: { in: targets },
        type: params.type,
        entityId: params.entityId ?? null,
        createdAt: { gte: since },
      },
      select: { userId: true },
    });
    const seen = new Set(recent.map((r) => r.userId));
    targets = targets.filter((id) => !seen.has(id));
    if (targets.length === 0) return;

    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        coupleId: params.coupleId,
        userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        data: params.data ?? Prisma.DbNull,
      })),
    });
  } catch (error) {
    console.error("[notify] fan-out failed:", error);
  }
}

export async function listNotifications(userId: string, take = 50) {
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
      data: true,
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
