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

export async function markDateActivitySeen(coupleId: string, userId: string): Promise<void> {
  await prisma.coupleMember.updateMany({
    where: { coupleId, userId },
    data: { activitySeenAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Partner activity — a few grouped lines of what the other person did lately.
// Deliberately not a feed: it only covers changes since you last looked, and
// it collapses a run of the same kind into one counted line.
// ---------------------------------------------------------------------------

export interface PartnerActivityItem {
  dateId: string;
  dateTitle: string;
  summary: string;
  at: string;
  count: number;
}

export interface PartnerActivity {
  actorName: string | null;
  items: PartnerActivityItem[];
  totalSince: number;
}

type ActivityBucket =
  | "photos"
  | "review"
  | "memory"
  | "revisit"
  | "recap"
  | "plan"
  | "status"
  | "created";

function bucketOf(kind: DateEventKind): ActivityBucket {
  switch (kind) {
    case "PHOTO_ADDED":
    case "BEST_PHOTO_SET":
      return "photos";
    case "REVIEW_WRITTEN":
      return "review";
    case "MEMORY_CREATED":
      return "memory";
    case "REVISIT_DECIDED":
      return "revisit";
    case "ACTUALS_RECORDED":
      return "recap";
    case "STATUS_CHANGED":
      return "status";
    case "CREATED":
      return "created";
    default:
      return "plan";
  }
}

function summarise(bucket: ActivityBucket, count: number, latestSummary: string): string {
  switch (bucket) {
    case "photos":
      return count === 1 ? "added a photo" : `added ${count} photos`;
    case "review":
      return "completed their review";
    case "memory":
      return "kept a memory";
    case "revisit":
      return "made a revisit decision";
    case "recap":
      return "recorded what happened";
    case "plan":
      return count === 1 ? "updated the plan" : `made ${count} plan changes`;
    case "status":
      return latestSummary; // already reads as "marked it completed" etc.
    case "created":
      return "started planning this";
  }
}

export async function getPartnerActivity(
  coupleId: string,
  userId: string,
  limit = 3,
): Promise<PartnerActivity> {
  const membership = await prisma.coupleMember.findFirst({
    where: { coupleId, userId },
    select: { activitySeenAt: true },
  });
  const since = membership?.activitySeenAt ?? new Date(0);

  const events = await prisma.dateEvent.findMany({
    where: {
      actorId: { not: userId },
      createdAt: { gt: since },
      date: { coupleId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      kind: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true, nickname: true } },
      date: { select: { id: true, title: true } },
    },
  });

  if (events.length === 0) return { actorName: null, items: [], totalSince: 0 };

  const groups = new Map<
    string,
    { dateId: string; dateTitle: string; bucket: ActivityBucket; count: number; at: Date; latest: string }
  >();
  for (const event of events) {
    const bucket = bucketOf(event.kind);
    const key = `${event.date.id}:${bucket}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        dateId: event.date.id,
        dateTitle: event.date.title || "Untitled date",
        bucket,
        count: 1,
        at: event.createdAt,
        latest: event.summary,
      });
    }
  }

  const items = [...groups.values()]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
    .map((g) => ({
      dateId: g.dateId,
      dateTitle: g.dateTitle,
      summary: summarise(g.bucket, g.count, g.latest),
      at: g.at.toISOString(),
      count: g.count,
    }));

  return {
    actorName: events[0].actor.nickname || events[0].actor.name,
    items,
    totalSince: events.length,
  };
}
