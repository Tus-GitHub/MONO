import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export interface NotificationPrefs {
  upcomingDate: boolean;
  dateDay: boolean;
  reviewReminder: boolean;
  unfinishedPlan: boolean;
  partnerEdits: boolean;
  pushEnabled: boolean;
}

const DEFAULTS: NotificationPrefs = {
  upcomingDate: true,
  dateDay: true,
  reviewReminder: true,
  unfinishedPlan: true,
  partnerEdits: true,
  pushEnabled: false,
};

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  return row ? { ...DEFAULTS, ...pick(row) } : DEFAULTS;
}

function pick(row: {
  upcomingDate: boolean;
  dateDay: boolean;
  reviewReminder: boolean;
  unfinishedPlan: boolean;
  partnerEdits: boolean;
  pushEnabled: boolean;
}): NotificationPrefs {
  return {
    upcomingDate: row.upcomingDate,
    dateDay: row.dateDay,
    reviewReminder: row.reviewReminder,
    unfinishedPlan: row.unfinishedPlan,
    partnerEdits: row.partnerEdits,
    pushEnabled: row.pushEnabled,
  };
}

export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return pick(row);
}

export async function setPushSubscription(
  userId: string,
  subscription: Record<string, unknown> | null,
): Promise<void> {
  const value: Prisma.InputJsonValue | typeof Prisma.DbNull =
    subscription == null ? Prisma.DbNull : (subscription as Prisma.InputJsonValue);
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, pushEnabled: subscription != null, pushSubscription: value },
    update: { pushEnabled: subscription != null, pushSubscription: value },
  });
}
