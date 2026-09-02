import "server-only";

import { DateStatus, Prisma, type PlaceCategory, type RevisitChoice } from "@prisma/client";

import { requireCoupleContext } from "@/lib/authz";
import type { HistoryQuery } from "@/lib/date/history-filters";
import { memorySnippet, type DateHistoryItem } from "@/lib/date/history-item";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { dateCoupleScore, reviewStage } from "@/lib/date/review-reveal";
import { prisma } from "@/lib/db/prisma";
import { PHOTO_SELECT, resolveDateCover } from "@/server/services/photo-service";

const HISTORY_TAKE = 250;

const PLACE_MINI = {
  select: { id: true, name: true, city: true, category: true, isFavorite: true },
} as const;

/** The one shape a completed date is loaded in for any history / memory list. */
export const HISTORY_INCLUDE = {
  plannedPlace: PLACE_MINI,
  actualPlace: PLACE_MINI,
  bestPhoto: { select: PHOTO_SELECT },
  memory: {
    select: {
      id: true,
      title: true,
      body: true,
      isFavorite: true,
      coverPhoto: { select: PHOTO_SELECT },
    },
  },
  photos: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    take: 1,
    select: PHOTO_SELECT,
  },
  revisitDecision: { select: { choice: true } },
  reviews: { select: { authorId: true, submittedAt: true, overallRating: true } },
  activities: { orderBy: { sortOrder: "asc" }, select: { title: true, kind: true } },
  expenses: { where: { deletedAt: null }, select: { amountCents: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.DateInclude;

export type HistoryRow = Prisma.DateGetPayload<{ include: typeof HISTORY_INCLUDE }>;

/** Flatten one completed-date row to a `DateHistoryItem`. The single mapper — no duplication. */
export function mapDateRowToItem(
  date: HistoryRow,
  ctx: { userId: string; hasPartner: boolean },
): DateHistoryItem {
  const place = date.actualPlace ?? date.plannedPlace;
  const dateYmd = (date.actualStartAt ?? date.scheduledFor)?.toISOString().slice(0, 10) ?? null;

  const mine = date.reviews.find((r) => r.authorId === ctx.userId) ?? null;
  const revealed =
    reviewStage({
      mineExists: mine != null,
      mineSubmitted: mine?.submittedAt != null,
      partnerSubmitted: date.reviews.some(
        (r) => r.authorId !== ctx.userId && r.submittedAt != null,
      ),
      hasPartner: ctx.hasPartner,
    }) === "revealed";
  const submittedOveralls = date.reviews
    .filter((r) => r.submittedAt != null)
    .map((r) => r.overallRating)
    .filter((n): n is number => n != null);

  const actualActs = date.activities.filter((a) => a.kind === "ACTUAL").map((a) => a.title);
  const plannedActs = date.activities.filter((a) => a.kind === "PLANNED").map((a) => a.title);
  const expenseSum = date.expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return {
    id: date.id,
    title: date.title || "Untitled date",
    dateYmd,
    completedAtIso: date.completedAt?.toISOString() ?? null,
    year: dateYmd ? Number(dateYmd.slice(0, 4)) : null,
    placeId: place?.id ?? null,
    placeName: place?.name ?? date.actualLocationText ?? null,
    placeCity: place?.city ?? null,
    placeCategory: place?.category ?? null,
    placeCategoryLabel: place ? PLACE_CATEGORY_LABEL[place.category] : null,
    placeIsFavorite: place?.isFavorite ?? false,
    cover: resolveDateCover({
      bestPhoto: date.bestPhoto,
      memoryCoverPhoto: date.memory?.coverPhoto ?? null,
      firstPhoto: date.photos[0] ?? null,
    }),
    photoCount: date._count.photos,
    coupleScore: dateCoupleScore(submittedOveralls, revealed),
    reviewRevealed: revealed,
    revisit: date.revisitDecision?.choice ?? null,
    hasMemory: date.memory != null,
    memoryId: date.memory?.id ?? null,
    memoryIsFavorite: date.memory?.isFavorite ?? false,
    memoryTitle: date.memory?.title ?? null,
    memorySnippet: memorySnippet(date.memory?.body),
    spendCents: date.actualSpendCents ?? (date.expenses.length > 0 ? expenseSum : null),
    currency: date.currency,
    activityTitles: (actualActs.length > 0 ? actualActs : plannedActs).slice(0, 5),
  };
}

export interface DateHistoryResult {
  items: DateHistoryItem[];
  total: number; // matched
  totalCompleted: number; // all completed dates — for the "nothing yet" state
}

export async function getDateHistory(query: HistoryQuery): Promise<DateHistoryResult> {
  const { user, couple } = await requireCoupleContext();
  const [memberCount, totalCompleted] = await Promise.all([
    prisma.coupleMember.count({ where: { coupleId: couple.id, status: "ACTIVE" } }),
    prisma.date.count({
      where: { coupleId: couple.id, deletedAt: null, status: DateStatus.COMPLETED },
    }),
  ]);
  const hasPartner = memberCount >= 2;

  const where: Prisma.DateWhereInput = {
    coupleId: couple.id,
    deletedAt: null,
    status: DateStatus.COMPLETED,
  };

  if (query.year) {
    const start = new Date(Date.UTC(query.year, (query.month ?? 1) - 1, 1));
    const end = query.month
      ? new Date(Date.UTC(query.year, query.month, 1))
      : new Date(Date.UTC(query.year + 1, 0, 1));
    where.scheduledFor = { gte: start, lt: end };
  }

  const and: Prisma.DateWhereInput[] = [];
  if (query.category) {
    and.push({
      OR: [
        { actualPlace: { is: { category: query.category } } },
        { plannedPlace: { is: { category: query.category } } },
      ],
    });
  }
  if (query.placeId) {
    and.push({ OR: [{ actualPlaceId: query.placeId }, { plannedPlaceId: query.placeId }] });
  }
  if (query.city) {
    and.push({
      OR: [
        { actualPlace: { is: { city: { equals: query.city, mode: "insensitive" } } } },
        { plannedPlace: { is: { city: { equals: query.city, mode: "insensitive" } } } },
      ],
    });
  }
  if (query.activity) {
    and.push({
      activities: { some: { title: { contains: query.activity, mode: "insensitive" } } },
    });
  }
  if (query.revisit) {
    and.push({ revisitDecision: { is: { choice: query.revisit } } });
  }
  if (query.q) {
    const q = query.q;
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { actualLocationText: { contains: q, mode: "insensitive" } },
        { actualPlace: { is: { name: { contains: q, mode: "insensitive" } } } },
        { plannedPlace: { is: { name: { contains: q, mode: "insensitive" } } } },
        { actualPlace: { is: { city: { contains: q, mode: "insensitive" } } } },
        { plannedPlace: { is: { city: { contains: q, mode: "insensitive" } } } },
        { activities: { some: { title: { contains: q, mode: "insensitive" } } } },
        { memory: { is: { title: { contains: q, mode: "insensitive" } } } },
        { memory: { is: { body: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const rows = await prisma.date.findMany({
    where,
    orderBy: [{ scheduledFor: { sort: "desc", nulls: "last" } }, { completedAt: "desc" }],
    take: HISTORY_TAKE,
    include: HISTORY_INCLUDE,
  });

  let items = rows.map((date) => mapDateRowToItem(date, { userId: user.id, hasPartner }));

  // Filters SQL can't express cleanly.
  if (query.month && !query.year) {
    items = items.filter(
      (item) => item.dateYmd != null && Number(item.dateYmd.slice(5, 7)) === query.month,
    );
  }
  if (query.minScore != null) {
    const min = query.minScore;
    items = items.filter((item) => item.coupleScore != null && item.coupleScore >= min);
  }

  return { items, total: items.length, totalCompleted };
}

export interface HistoryFilterOptions {
  years: number[];
  categories: PlaceCategory[];
  places: { id: string; name: string }[];
  cities: string[];
  revisits: RevisitChoice[];
}

/** The filter values that actually exist across the couple's completed dates. */
export async function getHistoryFilterOptions(): Promise<HistoryFilterOptions> {
  const { couple } = await requireCoupleContext();
  const rows = await prisma.date.findMany({
    where: { coupleId: couple.id, deletedAt: null, status: DateStatus.COMPLETED },
    select: {
      scheduledFor: true,
      actualStartAt: true,
      actualPlace: { select: { id: true, name: true, city: true, category: true } },
      plannedPlace: { select: { id: true, name: true, city: true, category: true } },
      revisitDecision: { select: { choice: true } },
    },
  });

  const years = new Set<number>();
  const categories = new Set<PlaceCategory>();
  const placeMap = new Map<string, string>();
  const cities = new Set<string>();
  const revisits = new Set<RevisitChoice>();

  for (const row of rows) {
    const yy = (row.actualStartAt ?? row.scheduledFor)?.toISOString().slice(0, 4);
    if (yy) years.add(Number(yy));
    for (const place of [row.actualPlace, row.plannedPlace]) {
      if (!place) continue;
      categories.add(place.category);
      placeMap.set(place.id, place.name);
      if (place.city?.trim()) cities.add(place.city.trim());
    }
    if (row.revisitDecision) revisits.add(row.revisitDecision.choice);
  }

  return {
    years: [...years].sort((a, b) => b - a),
    categories: [...categories].sort(),
    places: [...placeMap]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
    revisits: [...revisits],
  };
}
