import "server-only";

import { DateStatus, PlaceCategory, RevisitChoice } from "@prisma/client";

import type { CoverImage } from "@/lib/date/photo-view";
import { averageScore } from "@/lib/review/scale";
import { prisma } from "@/lib/db/prisma";
import { promoteDueDates } from "@/server/services/calendar-service";
import {
  getUnseenPartnerEdit,
  type PartnerEditView,
} from "@/server/services/date-event-service";
import { getUnreadNotificationCount } from "@/server/services/notification-service";
import { PHOTO_SELECT, resolveDateCover } from "@/server/services/photo-service";
import {
  getRecommendedDates,
  type DateRecommendation,
} from "@/server/services/recommendation-service";
import { dispatchDueReminders } from "@/server/services/reminder-service";

/** A section either loaded, or it didn't — so one failing query never blanks the whole page. */
export type Section<T> = { ok: true; value: T } | { ok: false };

async function section<T>(fn: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    console.error("[home] section failed:", error);
    return { ok: false };
  }
}

const UPCOMING_STATUSES = [
  DateStatus.PLANNED,
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
];

// ---------------------------------------------------------------------------

export interface HomeCounts {
  total: number;
  upcoming: number;
  completed: number;
  drafts: number;
  memories: number;
}

async function getCounts(coupleId: string): Promise<HomeCounts> {
  const [grouped, memories] = await Promise.all([
    prisma.date.groupBy({
      by: ["status"],
      where: { coupleId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.memory.count({ where: { coupleId, deletedAt: null } }),
  ]);
  const by = (status: DateStatus) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;

  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    upcoming: UPCOMING_STATUSES.reduce((sum, status) => sum + by(status), 0),
    completed: by(DateStatus.COMPLETED),
    drafts: by(DateStatus.DRAFT),
    memories,
  };
}

// ---------------------------------------------------------------------------

export interface UpcomingDateView {
  id: string;
  title: string;
  placeName: string | null;
  placeCity: string | null;
  placeCategory: PlaceCategory | null;
  scheduledFor: string | null;
  startAt: string | null;
  endAt: string | null;
  activities: string[];
  activityCount: number;
  expectedBudgetCents: number | null;
  currency: string;
  cover: CoverImage | null;
  status: DateStatus;
}

async function getUpcomingDate(coupleId: string): Promise<UpcomingDateView | null> {
  const date = await prisma.date.findFirst({
    where: { coupleId, deletedAt: null, status: { in: UPCOMING_STATUSES } },
    orderBy: [
      { scheduledFor: { sort: "asc", nulls: "last" } },
      { plannedStartAt: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      plannedPlace: { select: { name: true, city: true, category: true } },
      bestPhoto: { select: PHOTO_SELECT },
      activities: {
        where: { kind: "PLANNED" },
        orderBy: { sortOrder: "asc" },
        select: { title: true },
      },
      photos: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: PHOTO_SELECT,
      },
    },
  });
  if (!date) return null;

  return {
    id: date.id,
    title: date.title,
    placeName: date.plannedPlace?.name ?? null,
    placeCity: date.plannedPlace?.city ?? null,
    placeCategory: date.plannedPlace?.category ?? null,
    scheduledFor: date.scheduledFor?.toISOString() ?? null,
    startAt: date.plannedStartAt?.toISOString() ?? null,
    endAt: date.plannedEndAt?.toISOString() ?? null,
    activities: date.activities.slice(0, 4).map((activity) => activity.title),
    activityCount: date.activities.length,
    expectedBudgetCents: date.expectedBudgetCents,
    currency: date.currency,
    cover: resolveDateCover({ bestPhoto: date.bestPhoto, firstPhoto: date.photos[0] ?? null }),
    status: date.status,
  };
}

// ---------------------------------------------------------------------------

export interface LatestMemoryView {
  dateId: string;
  title: string;
  placeName: string | null;
  placeCity: string | null;
  completedAt: string | null;
  combinedScore10: number | null;
  revisit: RevisitChoice | null;
  memoryCaption: string | null;
  hasMemory: boolean;
  cover: CoverImage | null;
}

async function getLatestMemory(coupleId: string): Promise<LatestMemoryView | null> {
  const date = await prisma.date.findFirst({
    where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
    orderBy: [
      { completedAt: { sort: "desc", nulls: "last" } },
      { scheduledFor: "desc" },
      { updatedAt: "desc" },
    ],
    include: {
      actualPlace: { select: { name: true, city: true } },
      plannedPlace: { select: { name: true, city: true } },
      reviews: { where: { submittedAt: { not: null } }, select: { overallRating: true } },
      revisitDecision: { select: { choice: true } },
      bestPhoto: { select: PHOTO_SELECT },
      memory: {
        select: { title: true, body: true, coverPhoto: { select: PHOTO_SELECT } },
      },
      photos: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: PHOTO_SELECT,
      },
    },
  });
  if (!date) return null;

  const place = date.actualPlace ?? date.plannedPlace;
  const scores = date.reviews
    .map((review) => review.overallRating)
    .filter((n): n is number => n != null);
  const combined = averageScore(scores);
  const caption = date.memory?.body?.trim() || date.memory?.title?.trim() || null;

  return {
    dateId: date.id,
    title: date.title,
    placeName: place?.name ?? null,
    placeCity: place?.city ?? null,
    completedAt: date.completedAt?.toISOString() ?? null,
    combinedScore10: combined,
    revisit: date.revisitDecision?.choice ?? null,
    memoryCaption: caption,
    hasMemory: Boolean(date.memory),
    cover: resolveDateCover({
      bestPhoto: date.bestPhoto,
      memoryCoverPhoto: date.memory?.coverPhoto ?? null,
      firstPhoto: date.photos[0] ?? null,
    }),
  };
}

// ---------------------------------------------------------------------------

export interface CoupleStatsView {
  datesTogether: number;
  placesVisited: number;
  citiesExplored: number;
  averageScore10: number | null;
  favoriteCategory: PlaceCategory | null;
  memoriesKept: number;
  heroPhoto: CoverImage | null;
}

/** The photo that leads the "so far" stats — the most recent completed date that has one. */
async function getStatsHeroPhoto(coupleId: string): Promise<CoverImage | null> {
  const date = await prisma.date.findFirst({
    where: {
      coupleId,
      deletedAt: null,
      status: DateStatus.COMPLETED,
      OR: [{ bestPhotoId: { not: null } }, { photos: { some: { deletedAt: null } } }],
    },
    orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    select: {
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
  if (!date) return null;
  return resolveDateCover({
    bestPhoto: date.bestPhoto,
    memoryCoverPhoto: date.memory?.coverPhoto ?? null,
    firstPhoto: date.photos[0] ?? null,
  });
}

async function getStats(coupleId: string): Promise<CoupleStatsView> {
  const [completed, memoriesKept, heroPhoto] = await Promise.all([
    prisma.date.findMany({
      where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
      select: {
        actualPlace: { select: { id: true, category: true, city: true } },
        plannedPlace: { select: { id: true, category: true, city: true } },
        reviews: { where: { submittedAt: { not: null } }, select: { overallRating: true } },
      },
    }),
    prisma.memory.count({ where: { coupleId, deletedAt: null } }),
    getStatsHeroPhoto(coupleId),
  ]);

  const placeIds = new Set<string>();
  const cities = new Set<string>();
  const perDateScores: number[] = [];
  const categoryTally = new Map<PlaceCategory, number>();

  for (const date of completed) {
    const place = date.actualPlace ?? date.plannedPlace;
    if (place) {
      placeIds.add(place.id);
      if (place.city) cities.add(place.city.trim().toLowerCase());
      categoryTally.set(place.category, (categoryTally.get(place.category) ?? 0) + 1);
    }
    const overalls = date.reviews
      .map((review) => review.overallRating)
      .filter((n): n is number => n != null);
    if (overalls.length > 0) {
      perDateScores.push(overalls.reduce((a, b) => a + b, 0) / overalls.length);
    }
  }

  const favorite =
    [...categoryTally.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? null;

  return {
    datesTogether: completed.length,
    placesVisited: placeIds.size,
    citiesExplored: cities.size,
    averageScore10:
      perDateScores.length > 0
        ? Math.round((perDateScores.reduce((a, b) => a + b, 0) / perDateScores.length) * 10) / 10
        : null,
    favoriteCategory: favorite,
    memoriesKept,
    heroPhoto,
  };
}

// ---------------------------------------------------------------------------

async function getPendingReviewCount(coupleId: string, userId: string): Promise<number> {
  return prisma.date.count({
    where: {
      coupleId,
      deletedAt: null,
      status: DateStatus.COMPLETED,
      // "pending" = I haven't *submitted* my side yet (a private draft still counts as pending)
      reviews: { none: { authorId: userId, submittedAt: { not: null } } },
    },
  });
}

async function getMembers(coupleId: string) {
  const rows = await prisma.coupleMember.findMany({
    where: { coupleId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      user: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
    },
  });
  return rows.map((row) => ({
    id: row.user.id,
    name: row.user.name,
    nickname: row.user.nickname,
    avatarUrl: row.user.avatarUrl,
  }));
}

// ---------------------------------------------------------------------------

export interface HomeData {
  couple: { name: string | null; photoUrl: string | null; anniversaryAt: string | null; timezone: string };
  members: { id: string; name: string; nickname: string | null; avatarUrl: string | null }[];
  counts: HomeCounts;
  unreadNotifications: number;
  pendingReviewCount: number;
  upcoming: Section<UpcomingDateView | null>;
  latestMemory: Section<LatestMemoryView | null>;
  stats: Section<CoupleStatsView>;
  recommendations: Section<DateRecommendation[]>;
  partnerEdit: PartnerEditView | null;
}

/**
 * Everything Home needs, in one call. Structural data (couple, members, counts) throws on
 * failure so the route's error boundary can take over; each enrichment section degrades on
 * its own instead.
 */
export async function getHomeData(coupleId: string, userId: string): Promise<HomeData> {
  // Best-effort housekeeping — never blocks or breaks Home.
  await Promise.allSettled([
    promoteDueDates(coupleId),
    dispatchDueReminders(userId),
  ]);

  const [
    couple,
    members,
    counts,
    unread,
    pending,
    partnerEdit,
    upcoming,
    latestMemory,
    stats,
    recommendations,
  ] = await Promise.all([
    prisma.couple.findUniqueOrThrow({
      where: { id: coupleId },
      select: { name: true, photoUrl: true, anniversaryAt: true, timezone: true },
    }),
    getMembers(coupleId),
    getCounts(coupleId),
    getUnreadNotificationCount(userId).catch(() => 0),
    getPendingReviewCount(coupleId, userId).catch(() => 0),
    getUnseenPartnerEdit(coupleId, userId).catch(() => null),
    section(() => getUpcomingDate(coupleId)),
    section(() => getLatestMemory(coupleId)),
    section(() => getStats(coupleId)),
    section(() => getRecommendedDates(coupleId)),
  ]);

  return {
    couple: {
      name: couple.name,
      photoUrl: couple.photoUrl,
      anniversaryAt: couple.anniversaryAt?.toISOString() ?? null,
      timezone: couple.timezone,
    },
    members,
    counts,
    unreadNotifications: unread,
    pendingReviewCount: pending,
    partnerEdit,
    upcoming,
    latestMemory,
    stats,
    recommendations,
  };
}
