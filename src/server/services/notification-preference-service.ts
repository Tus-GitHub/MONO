import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { lockLivingUser } from "@/lib/authz/user-write";
import { AuthenticationError } from "@/lib/errors";
import { pushSubscriptionSchema } from "@/lib/notifications/subscription";
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
  const row = await serializable(async (tx) => {
    await lockLivingUser(tx, userId);
    return tx.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: patch,
    });
  });
  return pick(row as PrefRow);
}

export async function setPushSubscription(
  userId: string,
  subscription: Record<string, unknown> | null,
  endpoint?: string,
  authSessionId?: string,
): Promise<{ id: string } | null> {
  if (subscription == null) {
    if (endpoint) await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return null;
  }
  const data = pushSubscriptionSchema.parse(subscription);
  return serializable(async (tx) => {
    await lockLivingUser(tx, userId);
    if (authSessionId && !await tx.authSession.findFirst({ where: {
      id: authSessionId, userId, revokedAt: null, expiresAt: { gt: new Date() },
    }, select: { id: true } })) throw new AuthenticationError();
    const device = await tx.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: { userId, endpoint: data.endpoint, data, authSessionId: authSessionId ?? null },
      update: { userId, data, authSessionId: authSessionId ?? null },
      select: { id: true },
    });
    await tx.notificationPreference.upsert({
      where: { userId },
      create: { userId, pushEnabled: true },
      update: { pushEnabled: true, pushSubscription: Prisma.DbNull },
    });
    return device;
  });
}
