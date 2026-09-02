import "server-only";

import { DateStatus, NotificationType, type RevisitChoice } from "@prisma/client";

import { authorizeDate, authorizeMemory, requireCoupleContext } from "@/lib/authz";
import { computeMilestones, type Milestone } from "@/lib/date/milestones";
import type { DateHistoryItem } from "@/lib/date/history-item";
import type { CoverImage, PhotoView, WallPhoto } from "@/lib/date/photo-view";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { formatMoney } from "@/lib/utils/format";
import type { DateMemoryInput } from "@/lib/validation/date";
import { getDateExperience } from "@/server/services/date-service";
import { logDateEvent } from "@/server/services/date-event-service";
import {
  HISTORY_INCLUDE,
  mapDateRowToItem,
} from "@/server/services/history-service";
import { notifyPartner } from "@/server/services/notification-service";
import {
  getBestPhotoWall,
  listFavoritePhotos,
  PHOTO_SELECT,
  toPhotoView,
} from "@/server/services/photo-service";
import { ensureMemoryReminder } from "@/server/services/reminder-service";

const MEMORABLE_STATUSES: DateStatus[] = [DateStatus.IN_PROGRESS, DateStatus.COMPLETED];

export interface MemoryContext {
  dateTitle: string;
  status: DateStatus;
  memorable: boolean;
  photos: PhotoView[];
  memory: {
    id: string;
    title: string;
    body: string;
    isFavorite: boolean;
    coverPhotoId: string | null;
  } | null;
}

export async function getMemoryContext(dateId: string): Promise<MemoryContext> {
  const { resource } = await authorizeDate(dateId);
  const date = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    include: {
      photos: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: PHOTO_SELECT,
      },
      memory: { select: { id: true, title: true, body: true, isFavorite: true, coverPhotoId: true } },
    },
  });
  return {
    dateTitle: date.title,
    status: date.status,
    memorable: MEMORABLE_STATUSES.includes(date.status),
    photos: date.photos.map((row) => toPhotoView(row, date.bestPhotoId)),
    memory: date.memory,
  };
}

export async function saveMemory(dateId: string, input: DateMemoryInput) {
  const { context, resource } = await authorizeDate(dateId);
  if (!MEMORABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Keep a memory once the date has happened.");
  }

  let coverPhotoId: string | null = null;
  if (input.coverPhotoId) {
    const photo = await prisma.datePhoto.findFirst({
      where: { id: input.coverPhotoId, dateId: resource.id, deletedAt: null },
      select: { id: true },
    });
    if (!photo) throw new NotFoundError("That photo isn't on this date.");
    coverPhotoId = photo.id;
  }

  const date = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    select: { actualStartAt: true, scheduledFor: true, memory: { select: { id: true } } },
  });
  const isNew = !date.memory;
  const occurredOn = date.actualStartAt ?? date.scheduledFor ?? null;

  await prisma.memory.upsert({
    where: { dateId: resource.id },
    create: {
      coupleId: context.couple.id,
      dateId: resource.id,
      authorId: context.user.id,
      title: input.title,
      body: input.body,
      occurredOn,
      isFavorite: input.isFavorite,
      coverPhotoId,
    },
    update: {
      title: input.title,
      body: input.body,
      isFavorite: input.isFavorite,
      coverPhotoId,
      deletedAt: null,
    },
  });

  await logDateEvent(
    resource.id,
    context.user.id,
    "MEMORY_CREATED",
    isNew ? "kept this as a memory" : "updated the memory",
  );
  if (isNew) {
    await notifyPartner({
      coupleId: context.couple.id,
      actorId: context.user.id,
      type: NotificationType.MEMORY_ADDED,
      title: "A new memory",
      body: input.title,
      entityType: "Date",
      entityId: resource.id,
    });
  }
  await ensureMemoryReminder(resource.id); // a kept memory clears the nudge
}

export async function deleteMemory(dateId: string) {
  const { resource } = await authorizeDate(dateId);
  const deleted = await prisma.memory.updateMany({
    where: { dateId: resource.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (deleted.count === 0) throw new NotFoundError("There's no memory to remove.");
  await ensureMemoryReminder(resource.id); // removed again — re-arm if still completed
}

/** Heart / un-heart a memory. Returns the new state. */
export async function toggleMemoryFavorite(memoryId: string): Promise<boolean> {
  const { resource } = await authorizeMemory(memoryId);
  const next = !resource.isFavorite;
  await prisma.memory.update({ where: { id: resource.id }, data: { isFavorite: next } });
  return next;
}

// ===========================================================================
// The Memories experience — journal home, timeline, favorites, one detail.
// ===========================================================================

/** Load every completed date once, mapped + milestone-annotated. Shared by the memory views. */
async function loadCompleted(): Promise<{
  items: DateHistoryItem[];
  milestones: ReturnType<typeof computeMilestones>;
}> {
  const { user, couple } = await requireCoupleContext();
  const [memberCount, anniversary, rows] = await Promise.all([
    prisma.coupleMember.count({ where: { coupleId: couple.id, status: "ACTIVE" } }),
    prisma.couple.findUniqueOrThrow({
      where: { id: couple.id },
      select: { anniversaryAt: true },
    }),
    prisma.date.findMany({
      where: { coupleId: couple.id, deletedAt: null, status: DateStatus.COMPLETED },
      orderBy: [{ scheduledFor: { sort: "desc", nulls: "last" } }, { completedAt: "desc" }],
      include: HISTORY_INCLUDE,
    }),
  ]);
  const hasPartner = memberCount >= 2;
  const items = rows.map((row) => mapDateRowToItem(row, { userId: user.id, hasPartner }));
  const milestones = computeMilestones(
    items.map((i) => ({
      id: i.id,
      dateYmd: i.dateYmd,
      placeId: i.placeId,
      placeName: i.placeName,
      placeCity: i.placeCity,
      coupleScore: i.coupleScore,
    })),
    { anniversaryMMDD: anniversary.anniversaryAt?.toISOString().slice(5, 10) ?? null },
  );
  return { items, milestones };
}

export interface MemoryHome {
  totalCompleted: number;
  memoriesKept: number;
  favoriteMemories: number;
  bestPhotoCount: number;
  citiesExplored: string[];
  favoriteDates: DateHistoryItem[];
  recentMemories: DateHistoryItem[];
  bestPhotos: WallPhoto[];
  milestones: { item: DateHistoryItem; milestone: Milestone; ordinal: number }[];
}

export async function getMemoryHome(): Promise<MemoryHome> {
  const [{ items, milestones }, bestPhotos] = await Promise.all([
    loadCompleted(),
    getBestPhotoWall(),
  ]);

  const withMemory = items.filter((i) => i.hasMemory);
  const milestoneHighlights = items
    .filter((i) => milestones.byId.has(i.id))
    .slice(0, 5)
    .map((item) => ({
      item,
      milestone: milestones.byId.get(item.id)![0],
      ordinal: milestones.ordinals.get(item.id) ?? 0,
    }));

  return {
    totalCompleted: items.length,
    memoriesKept: withMemory.length,
    favoriteMemories: withMemory.filter((i) => i.memoryIsFavorite).length,
    bestPhotoCount: bestPhotos.length,
    citiesExplored: milestones.citiesExplored,
    favoriteDates: withMemory.filter((i) => i.memoryIsFavorite).slice(0, 6),
    recentMemories: withMemory.slice(0, 4),
    bestPhotos: bestPhotos.slice(0, 14),
    milestones: milestoneHighlights,
  };
}

export interface MemoryTimelineItem extends DateHistoryItem {
  ordinal: number;
  milestones: Milestone[];
}

export interface MemoryTimelineData {
  items: MemoryTimelineItem[];
  totalCompleted: number;
  citiesExplored: string[];
}

export async function getMemoryTimeline(): Promise<MemoryTimelineData> {
  const { items, milestones } = await loadCompleted();
  return {
    totalCompleted: items.length,
    citiesExplored: milestones.citiesExplored,
    items: items
      .filter((i) => i.hasMemory)
      .map((item) => ({
        ...item,
        ordinal: milestones.ordinals.get(item.id) ?? 0,
        milestones: milestones.byId.get(item.id) ?? [],
      })),
  };
}

export interface FavoritePlace {
  id: string;
  name: string;
  city: string | null;
  categoryLabel: string;
  visitCount: number;
}

export interface FavoritesData {
  dates: DateHistoryItem[];
  photos: WallPhoto[];
  places: FavoritePlace[];
}

export async function getFavorites(): Promise<FavoritesData> {
  const { couple } = await requireCoupleContext();
  const [{ items }, photos, placeRows] = await Promise.all([
    loadCompleted(),
    listFavoritePhotos(),
    prisma.place.findMany({
      where: { coupleId: couple.id, deletedAt: null, isFavorite: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, category: true },
    }),
  ]);

  // One pass over completed dates → visit counts for every favourite place (no N+1).
  const favoriteIds = new Set(placeRows.map((p) => p.id));
  const visits = new Map<string, number>();
  if (favoriteIds.size > 0) {
    const completedPlaces = await prisma.date.findMany({
      where: { coupleId: couple.id, deletedAt: null, status: DateStatus.COMPLETED },
      select: { plannedPlaceId: true, actualPlaceId: true },
    });
    for (const date of completedPlaces) {
      const placeId = date.actualPlaceId ?? date.plannedPlaceId;
      if (placeId && favoriteIds.has(placeId)) {
        visits.set(placeId, (visits.get(placeId) ?? 0) + 1);
      }
    }
  }

  const places: FavoritePlace[] = placeRows.map((place) => ({
    id: place.id,
    name: place.name,
    city: place.city,
    categoryLabel: PLACE_CATEGORY_LABEL[place.category],
    visitCount: visits.get(place.id) ?? 0,
  }));

  return {
    dates: items.filter((i) => i.memoryIsFavorite),
    photos,
    places,
  };
}

export interface MemoryDetail {
  memoryId: string;
  dateId: string | null;
  isFavorite: boolean;
  title: string;
  story: string;
  dateYmd: string | null;
  placeLabel: string | null;
  placeCategoryLabel: string | null;
  placeIsFavorite: boolean;
  hero: CoverImage | null;
  ordinal: number | null;
  milestones: Milestone[];
  coupleScore: number | null;
  reviewRevealed: boolean;
  topCategories: { label: string; score: number }[];
  revisit: RevisitChoice | null;
  revisitCompatLabel: string | null;
  spendLine: string | null;
  planLine: string | null;
  photos: PhotoView[];
}

const PLAN_LINE: Record<string, string> = {
  "as-planned": "It went almost exactly to plan.",
  adjusted: "A few things shifted on the night.",
  improvised: "Almost nothing went to plan — and that was the best of it.",
};

export async function getMemoryDetail(
  memoryId: string,
  userId: string,
): Promise<MemoryDetail> {
  const { resource } = await authorizeMemory(memoryId);

  const base: MemoryDetail = {
    memoryId: resource.id,
    dateId: resource.dateId,
    isFavorite: resource.isFavorite,
    title: resource.title,
    story: resource.body,
    dateYmd: resource.occurredOn?.toISOString().slice(0, 10) ?? null,
    placeLabel: null,
    placeCategoryLabel: null,
    placeIsFavorite: false,
    hero: null,
    ordinal: null,
    milestones: [],
    coupleScore: null,
    reviewRevealed: false,
    topCategories: [],
    revisit: null,
    revisitCompatLabel: null,
    spendLine: null,
    planLine: null,
    photos: [],
  };

  if (!resource.dateId) return base;

  const [exp, { milestones }] = await Promise.all([
    getDateExperience(resource.dateId, userId),
    loadCompleted(),
  ]);

  const place = exp.actual.place ?? exp.plan.place;
  const heroPhoto =
    exp.photos.find((p) => p.id === resource.coverPhotoId) ??
    exp.photos.find((p) => p.isBest) ??
    exp.photos[0] ??
    null;

  const comparison = exp.review.comparison;
  const topCategories = comparison
    ? [...comparison.categories]
        .filter((c) => c.combined != null)
        .sort((a, b) => (b.combined as number) - (a.combined as number))
        .slice(0, 3)
        .map((c) => ({ label: c.label, score: c.combined as number }))
    : [];

  const spend = exp.spending.effectiveSpendCents;
  const spendLine =
    spend != null
      ? `You spent ${formatMoney(spend, exp.date.currency)}` +
        (exp.spending.delta.state === "over" || exp.spending.delta.state === "under"
          ? ` · ${exp.spending.delta.label}`
          : exp.spending.delta.state === "on"
            ? " · right on budget"
            : "")
      : null;

  return {
    ...base,
    title: resource.title || exp.date.title,
    dateYmd: exp.actual.dateYmd ?? exp.date.scheduledForYmd,
    placeLabel: place
      ? `${place.name}${place.city ? `, ${place.city}` : ""}`
      : exp.actual.label,
    placeCategoryLabel: place ? PLACE_CATEGORY_LABEL[place.category] : null,
    placeIsFavorite: place?.isFavorite ?? false,
    hero: heroPhoto
      ? {
          thumbUrl: heroPhoto.thumbUrl,
          displayUrl: heroPhoto.displayUrl,
          fullUrl: heroPhoto.fullUrl,
          blurDataUrl: heroPhoto.blurDataUrl,
          width: heroPhoto.width,
          height: heroPhoto.height,
        }
      : null,
    ordinal: milestones.ordinals.get(resource.dateId) ?? null,
    milestones: milestones.byId.get(resource.dateId) ?? [],
    coupleScore: comparison?.coupleScore ?? null,
    reviewRevealed: exp.review.revealed,
    topCategories,
    revisit: exp.revisit?.choice ?? null,
    revisitCompatLabel: exp.review.revisitCompat?.label ?? null,
    spendLine,
    planLine: exp.comparison ? (PLAN_LINE[exp.comparison.divergence] ?? null) : null,
    photos: exp.photos,
  };
}
