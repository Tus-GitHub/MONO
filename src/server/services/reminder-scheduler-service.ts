import "server-only";

import { prisma } from "@/lib/db/prisma";
import { dispatchDueReminders } from "@/server/services/reminder-service";

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
      delivered += await dispatchDueReminders(userId);
    } catch (error) {
      failedUsers += 1;
      console.error("[reminder-scheduler] dispatch failed:", error);
    }
  }
  return { users: recipients.length, delivered, failedUsers };
}
