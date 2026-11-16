import "server-only";

import { DateStatus, RevisitChoice } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { averageScore } from "@/lib/review/scale";
import { sharedPlaceRatings } from "@/lib/date/place-ratings";
import { DATE_VENUE_SELECT, visitedPlaces } from "./date-venues";

export interface PlaceHistoryEntry {
  /** Revealed venue ratings, on the 1–10 scale. Never date-wide scores. */
  scores: number[];
  visits: number;
  lastRevisit: RevisitChoice | null;
  lastCompletedAt: number;
}

/** placeId → aggregate history across the couple's COMPLETED dates. Aggregate only. */
export async function getPlaceHistoryMap(
  coupleId: string,
): Promise<Map<string, PlaceHistoryEntry>> {
  const [members, dates] = await Promise.all([
    prisma.coupleMember.findMany({ where: { coupleId, status: "ACTIVE" }, select: { userId: true } }),
    prisma.date.findMany({
      where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
      orderBy: { completedAt: "asc" },
      select: {
        completedAt: true,
        ...DATE_VENUE_SELECT,
        reviews: { select: { authorId: true, submittedAt: true, placeRatings: { select: { placeId: true, score: true } } } },
        revisitDecision: { select: { choice: true } },
      },
    }),
  ]);
  const memberIds = members.map((member) => member.userId);

  const map = new Map<string, PlaceHistoryEntry>();
  for (const date of dates) {
    for (const { id: placeId } of visitedPlaces(date)) {
      const entry = map.get(placeId) ?? { scores: [], visits: 0, lastRevisit: null, lastCompletedAt: 0 };
      entry.visits += 1;
      entry.scores.push(...sharedPlaceRatings(date.reviews, memberIds, placeId).map((rating) => rating.score));
      if (date.revisitDecision) entry.lastRevisit = date.revisitDecision.choice;
      entry.lastCompletedAt = date.completedAt?.getTime() ?? entry.lastCompletedAt;
      map.set(placeId, entry);
    }
  }
  return map;
}

export function score10(entry: PlaceHistoryEntry | null | undefined): number | null {
  return entry ? averageScore(entry.scores) : null;
}
