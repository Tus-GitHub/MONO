import "server-only";

import {
  DateStatus,
  NotificationType,
  ReminderKind,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getPushChannel } from "@/lib/notifications/push";
import { formatWallDate, formatWallTime } from "@/lib/utils/format";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const LIVE_STATUSES: DateStatus[] = [
  DateStatus.PLANNED,
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
];

async function activeMemberIds(coupleId: string): Promise<string[]> {
  const rows = await prisma.coupleMember.findMany({
    where: { coupleId, status: "ACTIVE" },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

async function upsertReminder(
  dateId: string,
  userId: string,
  kind: ReminderKind,
  scheduledFor: Date,
): Promise<void> {
  await prisma.dateReminder.upsert({
    where: { dateId_userId_kind: { dateId, userId, kind } },
    create: { dateId, userId, kind, scheduledFor },
    // don't move a reminder that already fired
    update: { scheduledFor, sentAt: null },
  });
}

/** (Re)compute the schedule-based reminders for a live date; clears them otherwise. */
export async function ensureRemindersForDate(dateId: string): Promise<void> {
  const date = await prisma.date.findUnique({
    where: { id: dateId },
    select: {
      coupleId: true,
      status: true,
      deletedAt: true,
      scheduledFor: true,
      plannedStartAt: true,
    },
  });
  if (!date) return;

  const scheduleKinds: ReminderKind[] = [ReminderKind.UPCOMING, ReminderKind.DATE_DAY];

  if (
    date.deletedAt ||
    !date.scheduledFor ||
    !LIVE_STATUSES.includes(date.status)
  ) {
    await prisma.dateReminder.deleteMany({
      where: { dateId, kind: { in: scheduleKinds }, sentAt: null },
    });
    return;
  }

  const startsAt = date.plannedStartAt ?? date.scheduledFor;
  const dayAt = new Date(date.scheduledFor.getTime() + 9 * HOUR); // 09:00 on the day
  const memberIds = await activeMemberIds(date.coupleId);

  for (const userId of memberIds) {
    await upsertReminder(dateId, userId, ReminderKind.UPCOMING, new Date(startsAt.getTime() - DAY));
    await upsertReminder(dateId, userId, ReminderKind.DATE_DAY, dayAt);
  }
}

/** After completion, nudge whoever hasn't written a review. */
export async function ensureReviewReminders(dateId: string): Promise<void> {
  const date = await prisma.date.findUnique({
    where: { id: dateId },
    select: {
      coupleId: true,
      status: true,
      completedAt: true,
      reviews: { select: { authorId: true, submittedAt: true } },
    },
  });
  if (!date || date.status !== DateStatus.COMPLETED) return;

  // Only a *submitted* review counts as done — a private draft still needs a nudge.
  const reviewed = new Set(
    date.reviews.filter((review) => review.submittedAt != null).map((review) => review.authorId),
  );
  const memberIds = await activeMemberIds(date.coupleId);
  const fireAt = new Date((date.completedAt?.getTime() ?? Date.now()) + 2 * HOUR);

  for (const userId of memberIds) {
    if (reviewed.has(userId)) {
      await prisma.dateReminder.deleteMany({
        where: { dateId, userId, kind: ReminderKind.REVIEW, sentAt: null },
      });
    } else {
      await upsertReminder(dateId, userId, ReminderKind.REVIEW, fireAt);
    }
  }
}

/** A gentle nudge about a draft left untouched. */
export async function ensureUnfinishedPlanReminder(dateId: string): Promise<void> {
  const date = await prisma.date.findUnique({
    where: { id: dateId },
    select: { status: true, createdById: true, updatedAt: true, deletedAt: true },
  });
  if (!date || date.deletedAt || date.status !== DateStatus.DRAFT) {
    await prisma.dateReminder.deleteMany({
      where: { dateId, kind: ReminderKind.UNFINISHED_PLAN, sentAt: null },
    });
    return;
  }
  await upsertReminder(
    dateId,
    date.createdById,
    ReminderKind.UNFINISHED_PLAN,
    new Date(date.updatedAt.getTime() + 3 * DAY),
  );
}

const PREF_KEY: Record<ReminderKind, keyof PrefRow> = {
  UPCOMING: "upcomingDate",
  DATE_DAY: "dateDay",
  REVIEW: "reviewReminder",
  UNFINISHED_PLAN: "unfinishedPlan",
};

type PrefRow = {
  upcomingDate: boolean;
  dateDay: boolean;
  reviewReminder: boolean;
  unfinishedPlan: boolean;
  pushEnabled: boolean;
  pushSubscription: Prisma.JsonValue | null;
};

function messageFor(
  kind: ReminderKind,
  date: { id: string; title: string; scheduledFor: Date | null; plannedStartAt: Date | null },
) {
  const title = date.title || "your date";
  const day = date.scheduledFor ? formatWallDate(date.scheduledFor.toISOString().slice(0, 10), "medium") : "";
  const time = date.plannedStartAt
    ? formatWallTime(date.plannedStartAt.toISOString().slice(11, 16))
    : "";
  switch (kind) {
    case "UPCOMING":
      return { title: `${title} is tomorrow`, body: [day, time].filter(Boolean).join(" · ") || "Get ready." };
    case "DATE_DAY":
      return { title: `Today: ${title}`, body: time ? `Starts around ${time}.` : "Enjoy it." };
    case "REVIEW":
      return { title: `How was ${title}?`, body: "Add your review while it's fresh." };
    case "UNFINISHED_PLAN":
      return { title: `Finish planning ${title}`, body: "Your draft is waiting." };
  }
}

/** Reminders that are due for a user and not yet delivered (pref-filtered). */
export async function getDueReminders(userId: string, now: Date = new Date()) {
  const [rows, pref] = await Promise.all([
    prisma.dateReminder.findMany({
      where: {
        userId,
        sentAt: null,
        dismissedAt: null,
        scheduledFor: { lte: now },
        date: { deletedAt: null },
      },
      orderBy: { scheduledFor: "asc" },
      take: 20,
      include: {
        date: { select: { id: true, title: true, scheduledFor: true, plannedStartAt: true } },
      },
    }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
  ]);

  return rows.filter((row) => {
    if (!pref) return true; // defaults are all-on
    return pref[PREF_KEY[row.kind]] !== false;
  });
}

/**
 * Deliver every due reminder: an in-app Notification always, plus a push if the user has a
 * subscription. Idempotent — marks each `sentAt`. Safe to call opportunistically on page load.
 */
export async function dispatchDueReminders(userId: string): Promise<number> {
  const due = await getDueReminders(userId);
  if (due.length === 0) return 0;

  const pref = (await prisma.notificationPreference.findUnique({
    where: { userId },
  })) as PrefRow | null;
  const push = getPushChannel();

  for (const reminder of due) {
    const message = messageFor(reminder.kind, reminder.date);
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.DATE_REMINDER,
        title: message.title,
        body: message.body,
        entityType: "Date",
        entityId: reminder.date.id,
        data: { reminderKind: reminder.kind },
      },
    });
    if (pref?.pushEnabled && pref.pushSubscription) {
      await push
        .send(pref.pushSubscription, { ...message, url: `/dates/${reminder.date.id}` })
        .catch(() => undefined);
    }
    await prisma.dateReminder.update({
      where: { id: reminder.id },
      data: { sentAt: new Date() },
    });
  }
  return due.length;
}

export async function dismissReminder(id: string, userId: string): Promise<void> {
  await prisma.dateReminder.updateMany({
    where: { id, userId },
    data: { dismissedAt: new Date() },
  });
}
