import "server-only";

import { DateStatus, NotificationType } from "@prisma/client";

import { requireCoupleContext } from "@/lib/authz";
import type { CoverImage } from "@/lib/date/photo-view";
import { prisma } from "@/lib/db/prisma";
import { notifyCouple } from "@/server/services/notification-service";
import { PHOTO_SELECT, resolveDateCover } from "@/server/services/photo-service";

const HOUR = 3_600_000;

export interface CalendarDate {
  id: string;
  title: string;
  status: DateStatus;
  day: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM
  placeName: string | null;
  /** Populated for the day panel; omitted from the month grid (which shows no imagery). */
  cover?: CoverImage | null;
}

/**
 * Lazily promote PLANNED dates whose day has arrived to TODAY (there is no cron). Called from
 * calendar / upcoming / home reads so status stays honest without a scheduler.
 */
export async function promoteDueDates(coupleId: string): Promise<void> {
  const startOfToday = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const endOfToday = new Date(startOfToday.getTime() + 24 * HOUR);
  await prisma.date.updateMany({
    where: {
      coupleId,
      deletedAt: null,
      status: DateStatus.PLANNED,
      scheduledFor: { gte: startOfToday, lt: endOfToday },
    },
    data: { status: DateStatus.TODAY },
  });
  await nudgeStaleDates(coupleId);
}

/**
 * A date whose time has clearly passed but which is still TODAY / IN_PROGRESS needs a wrap-up.
 * One "needs completion" notification per date per day — never for a cancelled or deleted date.
 */
async function nudgeStaleDates(coupleId: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 18 * HOUR);
    const stale = await prisma.date.findMany({
      where: {
        coupleId,
        deletedAt: null,
        status: { in: [DateStatus.TODAY, DateStatus.IN_PROGRESS] },
        OR: [
          { plannedEndAt: { lt: cutoff } },
          { AND: [{ plannedEndAt: null }, { scheduledFor: { lt: cutoff } }] },
        ],
      },
      select: { id: true, title: true },
      take: 10,
    });
    if (stale.length === 0) return;

    const since = new Date(Date.now() - 24 * HOUR);
    for (const date of stale) {
      const recent = await prisma.notification.findFirst({
        where: {
          coupleId,
          type: NotificationType.DATE_NEEDS_ACTION,
          entityId: date.id,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (recent) continue;
      await notifyCouple({
        coupleId,
        actorId: "system",
        type: NotificationType.DATE_NEEDS_ACTION,
        title: "A date is waiting to be wrapped up",
        body: `${date.title || "Your date"} still needs its outcome — record what happened or mark it done.`,
        entityType: "Date",
        entityId: date.id,
      });
    }
  } catch (error) {
    console.error("[calendar] stale-date nudge failed:", error);
  }
}

function toCalendarDate(row: {
  id: string;
  title: string;
  status: DateStatus;
  scheduledFor: Date | null;
  plannedStartAt: Date | null;
  plannedPlace: { name: string } | null;
}): CalendarDate {
  return {
    id: row.id,
    title: row.title || "Untitled date",
    status: row.status,
    day: row.scheduledFor ? row.scheduledFor.toISOString().slice(0, 10) : "",
    startTime: row.plannedStartAt ? row.plannedStartAt.toISOString().slice(11, 16) : null,
    placeName: row.plannedPlace?.name ?? null,
  };
}

/** All scheduled dates in a calendar month, grouped by day. `month` is "YYYY-MM". */
export async function getMonthDates(month: string): Promise<Record<string, CalendarDate[]>> {
  const { couple } = await requireCoupleContext();
  await promoteDueDates(couple.id);

  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 1));

  const rows = await prisma.date.findMany({
    where: {
      coupleId: couple.id,
      deletedAt: null,
      scheduledFor: { gte: start, lt: end },
    },
    orderBy: { plannedStartAt: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledFor: true,
      plannedStartAt: true,
      plannedPlace: { select: { name: true } },
    },
  });

  const map: Record<string, CalendarDate[]> = {};
  for (const row of rows) {
    const cal = toCalendarDate(row);
    (map[cal.day] ??= []).push(cal);
  }
  return map;
}

export async function getDayDates(day: string): Promise<CalendarDate[]> {
  const { couple } = await requireCoupleContext();
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  const rows = await prisma.date.findMany({
    where: {
      coupleId: couple.id,
      deletedAt: null,
      scheduledFor: { gte: start, lt: end },
    },
    orderBy: { plannedStartAt: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledFor: true,
      plannedStartAt: true,
      plannedPlace: { select: { name: true } },
      bestPhoto: { select: PHOTO_SELECT },
      memory: { select: { coverPhoto: { select: PHOTO_SELECT } } },
      photos: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: PHOTO_SELECT,
      },
    },
  });
  return rows.map((row) => ({
    ...toCalendarDate(row),
    cover: resolveDateCover({
      bestPhoto: row.bestPhoto,
      memoryCoverPhoto: row.memory?.coverPhoto ?? null,
      firstPhoto: row.photos[0] ?? null,
    }),
  }));
}
