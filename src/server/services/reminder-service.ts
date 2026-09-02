import "server-only";

import { DateStatus, NotificationType, ReminderKind } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { deliverNotification } from "@/lib/notifications/channels";
import {
  DEFAULT_CATEGORY_PREFS,
  type NotificationCategory,
} from "@/lib/notifications/prefs";
import { REMINDER_CATEGORY_OF } from "@/lib/notifications/types";
import { formatWallDate, formatWallTime } from "@/lib/utils/format";
import { zonedTimeToUtc } from "@/lib/utils/timezone";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A reminder more than this far past its time is treated as expired. */
const STALE_MS = 2 * DAY;
/** Don't create the same date's reminder-notification twice inside this window. */
const REDELIVER_MS = 18 * HOUR;

const LIVE_STATUSES: DateStatus[] = [
  DateStatus.PLANNED,
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
];

const SCHEDULE_KINDS: ReminderKind[] = [
  ReminderKind.UPCOMING,
  ReminderKind.DATE_DAY,
  ReminderKind.CUSTOM,
];

async function activeMemberIds(coupleId: string): Promise<string[]> {
  const rows = await prisma.coupleMember.findMany({
    where: { coupleId, status: "ACTIVE" },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

/**
 * Create or move a reminder. A reminder that already fired only gets a fresh shot (and loses a
 * prior dismissal) if its time actually moved — a trivial edit doesn't re-notify.
 */
async function upsertReminder(
  dateId: string,
  userId: string,
  kind: ReminderKind,
  scheduledFor: Date,
): Promise<void> {
  const existing = await prisma.dateReminder.findUnique({
    where: { dateId_userId_kind: { dateId, userId, kind } },
    select: { scheduledFor: true, sentAt: true, dismissedAt: true },
  });
  if (!existing) {
    await prisma.dateReminder.create({ data: { dateId, userId, kind, scheduledFor } });
    return;
  }
  const moved = Math.abs(existing.scheduledFor.getTime() - scheduledFor.getTime()) > HOUR;
  await prisma.dateReminder.update({
    where: { dateId_userId_kind: { dateId, userId, kind } },
    data: {
      scheduledFor,
      sentAt: moved ? null : existing.sentAt,
      dismissedAt: moved ? null : existing.dismissedAt,
    },
  });
}

// ---------------------------------------------------------------------------
// Schedulers — each is idempotent and safe to call from the relevant mutation.
// ---------------------------------------------------------------------------

/** (Re)compute the day-before / day-of reminders for a live date; clears them otherwise. */
export async function ensureRemindersForDate(dateId: string): Promise<void> {
  const date = await prisma.date.findUnique({
    where: { id: dateId },
    select: {
      coupleId: true,
      status: true,
      deletedAt: true,
      scheduledFor: true,
      plannedStartAt: true,
      couple: { select: { timezone: true } },
    },
  });
  if (!date) return;

  if (date.deletedAt || !date.scheduledFor || !LIVE_STATUSES.includes(date.status)) {
    // Never keep a schedule-based reminder for a cancelled / completed / deleted date.
    await prisma.dateReminder.deleteMany({
      where: { dateId, kind: { in: SCHEDULE_KINDS }, sentAt: null },
    });
    return;
  }

  const startsAt = date.plannedStartAt ?? date.scheduledFor;
  const ymd = date.scheduledFor.toISOString().slice(0, 10);
  const dayAt = zonedTimeToUtc(ymd, 9, 0, date.couple.timezone); // 09:00 in the couple's tz
  const memberIds = await activeMemberIds(date.coupleId);

  for (const userId of memberIds) {
    await upsertReminder(dateId, userId, ReminderKind.UPCOMING, new Date(startsAt.getTime() - DAY));
    await upsertReminder(dateId, userId, ReminderKind.DATE_DAY, dayAt);
  }
}

/** After completion, nudge whoever hasn't submitted a review. */
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
  if (!date) return;

  if (date.status !== DateStatus.COMPLETED) {
    await prisma.dateReminder.deleteMany({
      where: { dateId, kind: ReminderKind.REVIEW, sentAt: null },
    });
    return;
  }

  const reviewed = new Set(
    date.reviews.filter((r) => r.submittedAt != null).map((r) => r.authorId),
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

/** After completion, nudge the couple to keep a memory (one shared memory per date). */
export async function ensureMemoryReminder(dateId: string): Promise<void> {
  const date = await prisma.date.findUnique({
    where: { id: dateId },
    select: {
      coupleId: true,
      status: true,
      completedAt: true,
      memory: { select: { id: true, deletedAt: true } },
    },
  });
  if (!date) return;

  const hasMemory = date.memory != null && date.memory.deletedAt == null;
  if (date.status !== DateStatus.COMPLETED || hasMemory) {
    await prisma.dateReminder.deleteMany({
      where: { dateId, kind: ReminderKind.MEMORY, sentAt: null },
    });
    return;
  }

  const fireAt = new Date((date.completedAt?.getTime() ?? Date.now()) + DAY);
  for (const userId of await activeMemberIds(date.coupleId)) {
    await upsertReminder(dateId, userId, ReminderKind.MEMORY, fireAt);
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

// ---------------------------------------------------------------------------
// Custom (user-set) reminders
// ---------------------------------------------------------------------------

export async function setCustomReminder(
  dateId: string,
  userId: string,
  at: Date,
): Promise<void> {
  const date = await prisma.date.findUnique({
    where: { id: dateId },
    select: { status: true, deletedAt: true },
  });
  if (!date || date.deletedAt || !LIVE_STATUSES.includes(date.status)) {
    throw new Error("You can only set a reminder for a date that's still to come.");
  }
  await prisma.dateReminder.upsert({
    where: { dateId_userId_kind: { dateId, userId, kind: ReminderKind.CUSTOM } },
    create: { dateId, userId, kind: ReminderKind.CUSTOM, scheduledFor: at },
    update: { scheduledFor: at, sentAt: null, dismissedAt: null },
  });
}

export async function clearCustomReminder(dateId: string, userId: string): Promise<void> {
  await prisma.dateReminder.deleteMany({
    where: { dateId, userId, kind: ReminderKind.CUSTOM },
  });
}

/** Everything this user has pending / set for one date — for the date-page controls. */
export async function getUserDateReminders(dateId: string, userId: string) {
  const rows = await prisma.dateReminder.findMany({
    where: { dateId, userId },
    select: { id: true, kind: true, scheduledFor: true, sentAt: true, dismissedAt: true },
    orderBy: { scheduledFor: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    scheduledForIso: r.scheduledFor.toISOString(),
    sent: r.sentAt != null,
    dismissed: r.dismissedAt != null,
  }));
}

export async function snoozeReminder(
  id: string,
  userId: string,
  until?: Date,
): Promise<void> {
  await prisma.dateReminder.updateMany({
    where: { id, userId },
    data: {
      scheduledFor: until ?? new Date(Date.now() + DAY),
      sentAt: null,
      dismissedAt: null,
    },
  });
}

export async function dismissReminder(id: string, userId: string): Promise<void> {
  await prisma.dateReminder.updateMany({
    where: { id, userId },
    data: { dismissedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

function messageFor(
  kind: ReminderKind,
  date: { title: string; scheduledFor: Date | null; plannedStartAt: Date | null },
) {
  const title = date.title || "your date";
  const day = date.scheduledFor
    ? formatWallDate(date.scheduledFor.toISOString().slice(0, 10), "medium")
    : "";
  const time = date.plannedStartAt
    ? formatWallTime(date.plannedStartAt.toISOString().slice(11, 16))
    : "";
  switch (kind) {
    case ReminderKind.UPCOMING:
      return { title: `${title} is tomorrow`, body: [day, time].filter(Boolean).join(" · ") || "Get ready." };
    case ReminderKind.DATE_DAY:
      return { title: `Today: ${title}`, body: time ? `Starts around ${time}.` : "Enjoy it." };
    case ReminderKind.CUSTOM:
      return { title: `Reminder: ${title}`, body: [day, time].filter(Boolean).join(" · ") || "You asked to be reminded." };
    case ReminderKind.REVIEW:
      return { title: "Your date is waiting for its review.", body: `Add your side of ${title}.` };
    case ReminderKind.MEMORY:
      return { title: `Keep a memory of ${title}?`, body: "A few lines now is a lot in a year." };
    case ReminderKind.UNFINISHED_PLAN:
      return { title: `Finish planning ${title}`, body: "Your draft is waiting." };
  }
}

const NOTIF_TYPE_OF: Record<ReminderKind, NotificationType> = {
  UPCOMING: NotificationType.DATE_REMINDER,
  DATE_DAY: NotificationType.DATE_REMINDER,
  CUSTOM: NotificationType.DATE_REMINDER,
  REVIEW: NotificationType.REVIEW_REMINDER,
  MEMORY: NotificationType.MEMORY_REMINDER,
  UNFINISHED_PLAN: NotificationType.DATE_REMINDER,
};

type PrefRow = Record<NotificationCategory, boolean>;

function categoryAllowed(kind: ReminderKind, pref: PrefRow | null): boolean {
  const category = REMINDER_CATEGORY_OF[kind];
  if (!category) return true;
  return (pref ?? DEFAULT_CATEGORY_PREFS)[category] !== false;
}

/** A kind can only fire while its date is in a state that still makes sense. */
function stateAllows(kind: ReminderKind, status: DateStatus): boolean {
  if (status === DateStatus.CANCELLED) return false;
  if (kind === ReminderKind.REVIEW || kind === ReminderKind.MEMORY) {
    return status === DateStatus.COMPLETED;
  }
  if (kind === ReminderKind.UNFINISHED_PLAN) return status === DateStatus.DRAFT;
  return LIVE_STATUSES.includes(status);
}

/** Reminders due for a user, pref-filtered and state-checked; expired ones are retired. */
export async function getDueReminders(userId: string, now: Date = new Date()) {
  const [rows, pref] = await Promise.all([
    prisma.dateReminder.findMany({
      where: {
        userId,
        sentAt: null,
        dismissedAt: null,
        scheduledFor: { lte: now },
        date: { deletedAt: null, status: { not: DateStatus.CANCELLED } },
      },
      orderBy: { scheduledFor: "asc" },
      take: 25,
      include: {
        date: {
          select: { id: true, title: true, status: true, scheduledFor: true, plannedStartAt: true },
        },
      },
    }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
  ]);

  const stale = now.getTime() - STALE_MS;
  const expiredIds: string[] = [];
  const live = rows.filter((row) => {
    if (row.scheduledFor.getTime() < stale) {
      expiredIds.push(row.id);
      return false;
    }
    if (!stateAllows(row.kind, row.date.status)) {
      expiredIds.push(row.id);
      return false;
    }
    return categoryAllowed(row.kind, pref as PrefRow | null);
  });

  if (expiredIds.length > 0) {
    await prisma.dateReminder
      .updateMany({ where: { id: { in: expiredIds } }, data: { dismissedAt: now } })
      .catch(() => undefined);
  }

  return live;
}

/**
 * Deliver every due reminder across all channels. Idempotent — a reminder is marked `sentAt`
 * only once the in-app row is written, so a transient failure retries next pass. Also skips a
 * date whose same reminder-notification landed in the last 18h. Safe to call on page load.
 */
export async function dispatchDueReminders(userId: string): Promise<number> {
  const due = await getDueReminders(userId);
  if (due.length === 0) return 0;

  let delivered = 0;
  for (const reminder of due) {
    try {
      const type = NOTIF_TYPE_OF[reminder.kind];
      const recent = await prisma.notification.findFirst({
        where: {
          userId,
          type,
          entityId: reminder.date.id,
          createdAt: { gte: new Date(Date.now() - REDELIVER_MS) },
        },
        select: { id: true },
      });
      if (recent) {
        // already told them recently — retire this reminder quietly
        await prisma.dateReminder.update({
          where: { id: reminder.id },
          data: { sentAt: new Date() },
        });
        continue;
      }

      const message = messageFor(reminder.kind, reminder.date);
      const result = await deliverNotification(userId, {
        type,
        title: message.title,
        body: message.body,
        entityType: "Date",
        entityId: reminder.date.id,
        data: { reminderKind: reminder.kind, reminderId: reminder.id },
      });
      if (!result.ok) continue; // in-app write failed — leave for the next pass

      await prisma.dateReminder.update({
        where: { id: reminder.id },
        data: { sentAt: new Date() },
      });
      delivered += 1;
    } catch (error) {
      console.error("[reminder] dispatch failed:", error);
    }
  }
  return delivered;
}
