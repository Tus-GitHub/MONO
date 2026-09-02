import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_CATEGORY_PREFS,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications/prefs";

export type NotificationPrefs = Record<NotificationCategory, boolean> & {
  pushEnabled: boolean;
};

const DEFAULTS: NotificationPrefs = { ...DEFAULT_CATEGORY_PREFS, pushEnabled: false };

type PrefRow = Record<NotificationCategory, boolean> & { pushEnabled: boolean };

function pick(row: PrefRow): NotificationPrefs {
  const out = { pushEnabled: row.pushEnabled } as NotificationPrefs;
  for (const key of NOTIFICATION_CATEGORIES) out[key] = row[key];
  return out;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  return row ? { ...DEFAULTS, ...pick(row as PrefRow) } : DEFAULTS;
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
  return pick(row as PrefRow);
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
