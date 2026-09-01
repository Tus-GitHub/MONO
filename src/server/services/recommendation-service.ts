import "server-only";

import { DateStatus, PlaceCategory, RevisitChoice } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * Deterministic date recommendations — no AI, no randomness. Everything is derived from the
 * couple's own completed dates, ratings, revisit decisions, and saved places, then sorted
 * stably so the same data always yields the same list.
 */
export interface DateRecommendation {
  key: string;
  title: string;
  reason: string;
  category: PlaceCategory | null;
  placeId: string | null;
}

const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  RESTAURANT: "dinner",
  CAFE: "coffee",
  BAR: "night-out",
  PARK: "outdoor",
  CINEMA: "cinema",
  MUSEUM: "cultural",
  ACTIVITY: "hands-on",
  SHOPPING: "shopping",
  TRAVEL: "getaway",
  HOME: "at-home",
  OTHER: "low-key",
};

const STARTER_IDEAS: DateRecommendation[] = [
  {
    key: "starter-new",
    title: "Somewhere neither of you has been",
    reason: "A new place, chosen on purpose.",
    category: null,
    placeId: null,
  },
  {
    key: "starter-first",
    title: "Recreate your first date",
    reason: "Go back to where it started and see what's changed.",
    category: null,
    placeId: null,
  },
  {
    key: "starter-walk",
    title: "A long walk and a good coffee",
    reason: "Low effort, high return.",
    category: PlaceCategory.CAFE,
    placeId: null,
  },
];

export async function getRecommendedDates(
  coupleId: string,
  limit = 3,
): Promise<DateRecommendation[]> {
  const [completed, savedPlaces] = await Promise.all([
    prisma.date.findMany({
      where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
      select: {
        id: true,
        title: true,
        actualPlaceId: true,
        plannedPlaceId: true,
        actualPlace: { select: { id: true, name: true, category: true } },
        plannedPlace: { select: { id: true, name: true, category: true } },
        reviews: { where: { submittedAt: { not: null } }, select: { overallRating: true } },
        revisitDecision: { select: { choice: true } },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.place.findMany({
      where: { coupleId, deletedAt: null },
      select: { id: true, name: true, category: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const visitedPlaceIds = new Set<string>();
  const scoresByCategory = new Map<PlaceCategory, number[]>();

  for (const date of completed) {
    const place = date.actualPlace ?? date.plannedPlace;
    if (place) visitedPlaceIds.add(place.id);
    const scores = date.reviews
      .map((review) => review.overallRating)
      .filter((n): n is number => n != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    if (place && avg != null) {
      const list = scoresByCategory.get(place.category) ?? [];
      list.push(avg);
      scoresByCategory.set(place.category, list);
    }
  }

  const categoryAverages = [...scoresByCategory.entries()]
    .map(([category, scores]) => ({
      category,
      count: scores.length,
      avg10: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => b.avg10 - a.avg10 || b.count - a.count || a.category.localeCompare(b.category));

  const out: DateRecommendation[] = [];

  // 1) Places the couple explicitly wants to revisit.
  for (const date of completed) {
    if (out.length >= limit) break;
    if (date.revisitDecision?.choice !== RevisitChoice.YES) continue;
    const place = date.actualPlace ?? date.plannedPlace;
    if (!place || out.some((r) => r.placeId === place.id)) continue;
    out.push({
      key: `revisit-${place.id}`,
      title: `Go back to ${place.name}`,
      reason: "You both said you'd return.",
      category: place.category,
      placeId: place.id,
    });
  }

  // 2) A fresh place in the category the two of you rate highest.
  const top = categoryAverages[0];
  if (top) {
    for (const place of savedPlaces) {
      if (out.length >= limit) break;
      if (place.category !== top.category) continue;
      if (visitedPlaceIds.has(place.id)) continue;
      if (out.some((r) => r.placeId === place.id)) continue;
      out.push({
        key: `top-${place.id}`,
        title: place.name,
        reason: `Because you both love ${CATEGORY_LABEL[top.category]} dates — you rate them ${top.avg10.toFixed(1)}/10.`,
        category: place.category,
        placeId: place.id,
      });
    }
    if (out.length < limit && !out.some((r) => r.category === top.category)) {
      out.push({
        key: `top-category-${top.category}`,
        title: `Another ${CATEGORY_LABEL[top.category]} date`,
        reason: `It's your highest-rated kind — ${top.avg10.toFixed(1)}/10 between you.`,
        category: top.category,
        placeId: null,
      });
    }
  }

  // 3) Fill from stable starter ideas.
  for (const idea of STARTER_IDEAS) {
    if (out.length >= limit) break;
    if (out.some((r) => r.key === idea.key)) continue;
    out.push(idea);
  }

  return out.slice(0, limit);
}
