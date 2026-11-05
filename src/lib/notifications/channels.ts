import "server-only";

import type { Prisma } from "@prisma/client";
import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { enqueueNotification, processNotificationDeliveries } from "@/server/services/notification-delivery-service";

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
      await prisma.$transaction((tx) => enqueueNotification(tx, userId, payload));
      return { channel: this.name, ok: true };
    } catch (error) {
      return { channel: this.name, ok: false, error: String(error) };
    }
  }
}

/** Flush persisted push work without recreating the in-app notification. */
class PushRelayChannel implements NotificationChannel {
  readonly name = "push";
  async deliver(userId: string, _payload: DeliverablePayload): Promise<DeliveryResult> {
    const result = await processNotificationDeliveries({ userId });
    return { channel: this.name, ok: result.failed === 0 };
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
  const results: DeliveryResult[] = [];
  for (const channel of getNotificationChannels()) {
    try { results.push(await channel.deliver(userId, payload)); }
    catch { results.push({ channel: channel.name, ok: false, error: "delivery_failed" }); }
    if (channel.name === "inapp" && !results[0].ok) break;
  }
  for (const r of results) {
    if (!r.ok) console.error(`[notify] channel ${r.channel} failed: ${r.error}`);
  }
  const inApp = results.find((r) => r.channel === "inapp");
  return { ok: inApp?.ok ?? false, results };
}
