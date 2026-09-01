import "server-only";

import { DateEventKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/** Append a change to a date's collaboration log. Best-effort — never fails a mutation. */
export async function logDateEvent(
  dateId: string,
  actorId: string,
  kind: DateEventKind,
  summary: string,
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.dateEvent.create({
      data: { dateId, actorId, kind, summary, meta: meta ?? Prisma.DbNull },
    });
  } catch (error) {
    console.error("[date-event] log failed:", error);
  }
}

export interface DateEventView {
  id: string;
  kind: DateEventKind;
  summary: string;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null };
}

export async function listDateEvents(dateId: string, take = 20): Promise<DateEventView[]> {
  const rows = await prisma.dateEvent.findMany({
    where: { dateId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      kind: true,
      summary: true,
      createdAt: true,
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
  }));
}

export interface PartnerEditView {
  dateId: string;
  dateTitle: string;
  summary: string;
  actorName: string;
  at: string;
  unseenCount: number;
}

/**
 * The most recent change made by the *other* member on any of the couple's live dates,
 * since this member last looked at date activity. For a subtle, contextual indicator —
 * not a feed.
 */
export async function getUnseenPartnerEdit(
  coupleId: string,
  userId: string,
): Promise<PartnerEditView | null> {
  const membership = await prisma.coupleMember.findFirst({
    where: { coupleId, userId },
    select: { activitySeenAt: true },
  });
  const since = membership?.activitySeenAt ?? new Date(0);

  const where = {
    actorId: { not: userId },
    createdAt: { gt: since },
    date: { coupleId, deletedAt: null },
  } as const;

  const [latest, unseenCount] = await Promise.all([
    prisma.dateEvent.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        summary: true,
        actor: { select: { name: true, nickname: true } },
        date: { select: { id: true, title: true } },
      },
    }),
    prisma.dateEvent.count({ where }),
  ]);

  if (!latest) return null;
  return {
    dateId: latest.date.id,
    dateTitle: latest.date.title || "Untitled date",
    summary: latest.summary,
    actorName: latest.actor.nickname || latest.actor.name,
    at: latest.createdAt.toISOString(),
    unseenCount,
  };
}

export async function markDateActivitySeen(coupleId: string, userId: string): Promise<void> {
  await prisma.coupleMember.updateMany({
    where: { coupleId, userId },
    data: { activitySeenAt: new Date() },
  });
}
