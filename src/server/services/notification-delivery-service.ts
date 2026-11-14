import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type Notification } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LEASE_MS, MAX_ATTEMPTS, retryAt } from "@/lib/jobs/retry";
import { getPushChannel } from "@/lib/notifications/push";
import { pushSubscriptionSchema } from "@/lib/notifications/subscription";
import { NOTIFICATION_CATEGORY_OF, notificationHref } from "@/lib/notifications/types";
import { PushSubscriptionGoneError } from "@/lib/notifications/web-push";
import type { DeliverablePayload } from "@/lib/notifications/channels";
import { sessionState } from "@/lib/state/access";
import { DELIVERY_TRANSITIONS, deliveryOutcome } from "@/lib/jobs/lifecycle";

export async function enqueueNotification(
  tx: Prisma.TransactionClient,
  userId: string,
  payload: DeliverablePayload,
  coupleId?: string | null,
): Promise<Notification> {
  const notification = await tx.notification.create({
    data: { ...payload, userId, coupleId, data: payload.data ?? Prisma.DbNull },
  });
  const pref = await tx.notificationPreference.findUnique({ where: { userId }, select: { pushEnabled: true } });
  if (pref?.pushEnabled) {
    const devices = await tx.pushSubscription.findMany({ where: { userId }, select: { id: true } });
    if (devices.length) await tx.notificationDelivery.createMany({
      data: devices.map((device) => ({ userId, notificationId: notification.id, subscriptionId: device.id })),
      skipDuplicates: true,
    });
  }
  return notification;
}

/** Recheck permissions and the reminder occurrence just before sending; queued content can become obsolete. */
async function stillEligible(notification: Notification, userId: string): Promise<boolean> {
  if (notification.userId !== userId) return false;
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  const category = NOTIFICATION_CATEGORY_OF[notification.type];
  if (!user || !pref?.pushEnabled || (category && pref[category] === false)) return false;
  if (notification.coupleId && !await prisma.coupleMember.findFirst({
    where: { userId, coupleId: notification.coupleId, status: "ACTIVE", couple: { deletedAt: null, status: { in: ["PENDING", "ACTIVE"] } } },
    select: { id: true },
  })) return false;
  if (notification.entityType === "CoupleCall") {
    if (!notification.entityId || !notification.coupleId) return false;
    const call = await prisma.coupleCall.findFirst({ where: {
      id: notification.entityId, coupleId: notification.coupleId, calleeId: userId, status: "RINGING",
      createdAt: { gt: new Date(Date.now() - 60_000) },
    }, select: { callerId: true, calleeId: true } });
    return Boolean(call && await prisma.coupleMember.count({ where: {
      coupleId: notification.coupleId, userId: { in: [call.callerId, call.calleeId] }, status: "ACTIVE",
      user: { deletedAt: null }, couple: { deletedAt: null, status: "ACTIVE" },
    } }) === 2);
  }
  if (notification.entityType === "Date" && notification.entityId) {
    const date = await prisma.date.findFirst({
      where: {
        id: notification.entityId, deletedAt: null,
        couple: { deletedAt: null, status: { in: ["PENDING", "ACTIVE"] }, members: { some: { userId, status: "ACTIVE" } } },
      },
      select: { status: true },
    });
    if (!date) return false;
    const data = notification.data as Record<string, unknown> | null;
    if (typeof data?.reminderId === "string") {
      const reminder = await prisma.dateReminder.findFirst({ where: { id: data.reminderId, userId, dismissedAt: null }, select: { kind: true, scheduledFor: true, sentAt: true } });
      if (!reminder?.sentAt || reminder.scheduledFor.toISOString() !== data.scheduledFor) return false;
      if (reminder.kind === "REVIEW") return date.status === "COMPLETED" && !await prisma.dateReview.findFirst({
        where: { dateId: notification.entityId, authorId: userId, submittedAt: { not: null } }, select: { id: true },
      });
      if (reminder.kind === "MEMORY") return date.status === "COMPLETED" && !await prisma.memory.findFirst({
        where: { dateId: notification.entityId, deletedAt: null }, select: { id: true },
      });
      if (reminder.kind === "UNFINISHED_PLAN") return date.status === "DRAFT";
      return ["PLANNED", "TODAY", "IN_PROGRESS"].includes(date.status);
    }
  }
  return true;
}

/** Leased, at-least-once push delivery with bounded retry; provider acceptance is not proof of device display. */
export async function processNotificationDeliveries(options: { userId?: string; now?: Date; limit?: number; callId?: string } = {}) {
  const now = options.now ?? new Date();
  const report = { processed: 0, delivered: 0, failed: 0, cancelled: 0 };
  if (!getPushChannel().configured) return report;
  const scope = { userId: options.userId, ...(options.callId ? { notification: { entityType: "CoupleCall", entityId: options.callId } } : {}) };
  const expired = await prisma.notificationDelivery.updateMany({
    where: { ...scope, status: "PROCESSING", OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }], attempts: { gte: MAX_ATTEMPTS } },
    data: { status: "FAILED", leaseToken: null, leaseUntil: null, lastError: "lease_expired" },
  });
  report.failed += expired.count;
  const claimable = {
    attempts: { lt: MAX_ATTEMPTS },
    OR: [
      { status: "PENDING" as const, nextAttemptAt: { lte: now } },
      { status: "PROCESSING" as const, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    ],
  };
  const candidates = await prisma.notificationDelivery.findMany({
    where: { ...claimable, ...scope }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(options.limit ?? 12, 1), 24), select: { id: true },
  });
  async function deliver(id: string) {
    const token = randomUUID();
    const claim = await prisma.notificationDelivery.updateMany({
      where: { id, ...claimable },
      data: { status: "PROCESSING", attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (!claim.count) return;
    report.processed++;
    const job = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id }, include: { notification: true, subscription: { include: { authSession: { include: { user: { select: { tokenVersion: true } } } } } } } });
    if (job.leaseToken !== token) return;
    const finish = (data: Prisma.NotificationDeliveryUpdateManyMutationInput) => {
      if (typeof data.status === "string" && !DELIVERY_TRANSITIONS.PROCESSING.includes(data.status)) throw new Error("Invalid delivery transition.");
      return prisma.notificationDelivery.updateMany({
        where: { id, status: "PROCESSING", leaseToken: token }, data: { ...data, leaseToken: null, leaseUntil: null },
      });
    };
    try {
      const parsed = pushSubscriptionSchema.safeParse(job.subscription?.data);
      const deviceSession = job.subscription?.authSession;
      if (!job.subscription || job.subscription.userId !== job.userId || !parsed.success
        || (job.subscription.authSessionId && (!deviceSession || deviceSession.userId !== job.userId || sessionState(deviceSession, now) !== "active"))
        || job.notification.createdAt.getTime() < now.getTime() - 2 * 86_400_000
        || !await stillEligible(job.notification, job.userId)) {
        await finish({ status: "CANCELLED", lastError: "no_longer_eligible" });
        report.cancelled++;
        return;
      }
      try {
        const callId = job.notification.entityType === "CoupleCall" ? job.notification.entityId : null;
        const expiresAt = job.notification.createdAt.getTime() + 60_000;
        await getPushChannel().send(parsed.data, {
          title: job.notification.title, body: job.notification.body ?? "",
          url: notificationHref(job.notification), tag: `mono_${job.notification.id}`,
          ...(callId ? { callId, expiresAt, tag: `call_${callId}`, ttl: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)), urgency: "high" as const } : {}),
        });
      } catch (error) {
        if (error instanceof PushSubscriptionGoneError) {
          // A stale response must not delete newly rotated keys for the same endpoint.
          await prisma.pushSubscription.deleteMany({
            where: {
              id: job.subscription.id, userId: job.userId, updatedAt: job.subscription.updatedAt,
              data: { equals: job.subscription.data as Prisma.InputJsonValue },
            }
          });
          await finish({ status: "CANCELLED", lastError: "subscription_gone" });
          report.cancelled++;
          return;
        }
        throw error;
      }
      await finish({ status: "DELIVERED", deliveredAt: new Date(), lastError: null });
      report.delivered++;
    } catch {
      await finish({ status: deliveryOutcome(job.attempts), nextAttemptAt: retryAt(job.attempts, now), lastError: "delivery_failed" });
      report.failed++;
    }
  }
  // Four bounded network requests at a time; never hold a DB transaction during HTTP.
  for (let index = 0; index < candidates.length; index += 4) {
    await Promise.all(candidates.slice(index, index + 4).map((candidate) => deliver(candidate.id)));
  }
  return report;
}
