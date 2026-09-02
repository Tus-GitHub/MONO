import "server-only";

import { DateStatus, RevisitChoice } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { averageScore } from "@/lib/review/scale";

export interface PlaceHistoryEntry {
  /** submitted overall ratings, on the 1–10 scale */
  scores: number[];
  visits: number;
  lastRevisit: RevisitChoice | null;
  lastCompletedAt: number;
}

/** placeId → aggregate history across the couple's COMPLETED dates. Aggregate only. */
export async function getPlaceHistoryMap(
  coupleId: string,
): Promise<Map<string, PlaceHistoryEntry>> {
  const dates = await prisma.date.findMany({
    where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
    orderBy: { completedAt: "asc" },
    select: {
      completedAt: true,
      actualPlaceId: true,
      plannedPlaceId: true,
      reviews: { where: { submittedAt: { not: null } }, select: { overallRating: true } },
      revisitDecision: { select: { choice: true } },
    },
  });

  const map = new Map<string, PlaceHistoryEntry>();
  for (const date of dates) {
    const placeId = date.actualPlaceId ?? date.plannedPlaceId;
    if (!placeId) continue;
    const entry =
      map.get(placeId) ?? { scores: [], visits: 0, lastRevisit: null, lastCompletedAt: 0 };
    entry.visits += 1;
    for (const review of date.reviews) {
      if (review.overallRating != null) entry.scores.push(review.overallRating);
    }
    if (date.revisitDecision) entry.lastRevisit = date.revisitDecision.choice;
    entry.lastCompletedAt = date.completedAt?.getTime() ?? entry.lastCompletedAt;
    map.set(placeId, entry);
  }
  return map;
}

export function score10(entry: PlaceHistoryEntry | null | undefined): number | null {
  return entry ? averageScore(entry.scores) : null;
}
