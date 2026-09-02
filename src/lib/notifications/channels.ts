import "server-only";

import { Prisma } from "@prisma/client";
import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getPushChannel } from "@/lib/notifications/push";
import { notificationHref } from "@/lib/notifications/types";
import { PushSubscriptionGoneError } from "@/lib/notifications/web-push";
import { setPushSubscription } from "@/server/services/notification-preference-service";

/**
 * Delivery is provider-agnostic. A `NotificationChannel` takes a resolved payload and gets it to
 * one user; the reminder dispatcher fans a payload across every registered channel. Add email /
 * FCM / APNs by implementing this interface and adding it to `getNotificationChannels()` — no
 * caller changes.
 */
export interface DeliverablePayload {
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  data?: Prisma.InputJsonValue;
}

export interface DeliveryResult {
  channel: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export interface NotificationChannel {
  readonly name: string;
  deliver(userId: string, payload: DeliverablePayload): Promise<DeliveryResult>;
}

/** The always-on, reliable channel: a row in the in-app notification centre. */
class InAppChannel implements NotificationChannel {
  readonly name = "inapp";
  async deliver(userId: string, payload: DeliverablePayload): Promise<DeliveryResult> {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body ?? null,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          data: payload.data ?? Prisma.DbNull,
        },
      });
      return { channel: this.name, ok: true };
    } catch (error) {
      return { channel: this.name, ok: false, error: String(error) };
    }
  }
}

/** Best-effort browser push via whatever provider `push.ts` returns (Noop until wired). */
class PushRelayChannel implements NotificationChannel {
  readonly name = "push";
  async deliver(userId: string, payload: DeliverablePayload): Promise<DeliveryResult> {
    try {
      const pref = await prisma.notificationPreference.findUnique({
        where: { userId },
        select: { pushEnabled: true, pushSubscription: true },
      });
      if (!pref?.pushEnabled || !pref.pushSubscription) {
        return { channel: this.name, ok: true, skipped: true };
      }
      try {
        await getPushChannel().send(pref.pushSubscription, {
          title: payload.title,
          body: payload.body ?? "",
          url: notificationHref({
            type: payload.type,
            entityType: payload.entityType ?? null,
            entityId: payload.entityId ?? null,
          }),
        });
      } catch (error) {
        if (error instanceof PushSubscriptionGoneError) {
          // The browser unsubscribed / the endpoint rotated — forget it so we stop trying.
          await setPushSubscription(userId, null).catch(() => undefined);
          return { channel: this.name, ok: true, skipped: true };
        }
        throw error;
      }
      return { channel: this.name, ok: true };
    } catch (error) {
      return { channel: this.name, ok: false, error: String(error) };
    }
  }
}

let registry: NotificationChannel[] | null = null;

export function getNotificationChannels(): NotificationChannel[] {
  if (!registry) registry = [new InAppChannel(), new PushRelayChannel()];
  return registry;
}

/**
 * Deliver one payload to one user across every channel. The in-app channel is authoritative:
 * `ok` is true iff it succeeded. Other channels failing is logged, not fatal.
 */
export async function deliverNotification(
  userId: string,
  payload: DeliverablePayload,
): Promise<{ ok: boolean; results: DeliveryResult[] }> {
  const results = await Promise.all(
    getNotificationChannels().map((channel) => channel.deliver(userId, payload)),
  );
  for (const r of results) {
    if (!r.ok) console.error(`[notify] channel ${r.channel} failed: ${r.error}`);
  }
  const inApp = results.find((r) => r.channel === "inapp");
  return { ok: inApp?.ok ?? false, results };
}
