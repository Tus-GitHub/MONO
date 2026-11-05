import "server-only";

import { prisma } from "@/lib/db/prisma";
import { dispatchDueRemindersDetailed } from "@/server/services/reminder-service";
import { processNotificationDeliveries } from "@/server/services/notification-delivery-service";
import { processStorageCleanup } from "@/server/services/storage-cleanup-service";

/** Trusted scheduler entry point; user IDs come only from persisted due reminders. */
export async function dispatchScheduledReminders() {
  const recipients = await prisma.dateReminder.findMany({
    where: {
      sentAt: null,
      dismissedAt: null,
      scheduledFor: { lte: new Date() },
      user: { deletedAt: null },
      date: { deletedAt: null, status: { not: "CANCELLED" } },
    },
    distinct: ["userId"],
    select: { userId: true },
    orderBy: { scheduledFor: "asc" },
  });
  let delivered = 0;
  let failedUsers = 0;
  for (const { userId } of recipients) {
    try {
      const result = await dispatchDueRemindersDetailed(userId);
      delivered += result.delivered;
      if (result.failed > 0) failedUsers++;
    } catch (error) {
      failedUsers += 1;
      console.error("[reminder-scheduler] dispatch failed:", error);
    }
  }
  const delivery = await processNotificationDeliveries();
  const cleanup = await processStorageCleanup();
  return { users: recipients.length, delivered, failedUsers, delivery, cleanup };
}
