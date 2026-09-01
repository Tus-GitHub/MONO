import "server-only";

import { DateStatus, PlaceCategory, RevisitChoice } from "@prisma/client";

import {
  authorizeDate,
  authorizePlace,
  requireCoupleContext,
  type CoupleContext,
} from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getExternalPlaceProvider } from "@/lib/places";
import { storage } from "@/lib/storage";
import { logDateEvent } from "@/server/services/date-event-service";
import { getPlaceHistoryMap, score10 } from "@/server/services/place-history";
import type { CustomPlaceInput, SelectPlaceInput } from "@/lib/validation/place";

export interface PlaceSummary {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string | null;
}

// --- save / favourite / custom -------------------------------------------

/** Resolve a place selection to a saved MONO `Place` (creating one for external/custom). */
export async function resolvePlace(
  context: CoupleContext,
  input: SelectPlaceInput,
): Promise<PlaceSummary> {
  const coupleId = context.couple.id;

  if (input.mode === "saved") {
    const place = await prisma.place.findFirst({
      where: { id: input.savedPlaceId, coupleId, deletedAt: null },
      select: { id: true, name: true, category: true, city: true },
    });
    if (!place) throw new NotFoundError("That place isn't in your list.");
    return place;
  }

  if (input.mode === "custom") {
    const place = await prisma.place.create({
      data: {
        coupleId,
        createdById: context.user.id,
        name: input.name,
        category: input.category,
        address: input.address ?? null,
        city: input.city ?? null,
      },
      select: { id: true, name: true, category: true, city: true },
    });
    return place;
  }

  // external
  const existing = await prisma.place.findFirst({
    where: {
      coupleId,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      deletedAt: null,
    },
    select: { id: true, name: true, category: true, city: true },
  });
  if (existing) return existing;

  const provider = getExternalPlaceProvider();
  const detail =
    provider && provider.name === input.provider
      ? await provider.details(input.providerPlaceId).catch(() => null)
      : null;
  if (!detail) {
    throw new ValidationError("Couldn't fetch that place — try adding it as a custom place.");
  }

  const created = await prisma.place.create({
    data: {
      coupleId,
      createdById: context.user.id,
      provider: detail.provider,
      providerPlaceId: detail.providerPlaceId,
      name: detail.name,
      category: detail.category ?? PlaceCategory.OTHER,
      address: detail.address,
      city: detail.city,
      latitude: detail.latitude,
      longitude: detail.longitude,
      imageUrl: detail.imageUrl,
      description: detail.description,
      website: detail.website,
      phone: detail.phone,
      openingText: detail.openingText,
      externalRating: detail.externalRating,
      externalRatingCount: detail.externalRatingCount,
      priceLevel: detail.priceLevel,
    },
    select: { id: true, name: true, category: true, city: true },
  });
  return created;
}

export async function savePlace(input: SelectPlaceInput): Promise<PlaceSummary> {
  const context = await requireCoupleContext();
  return resolvePlace(context, input);
}

export async function createCustomPlace(input: CustomPlaceInput): Promise<PlaceSummary> {
  const context = await requireCoupleContext();
  return prisma.place.create({
    data: {
      coupleId: context.couple.id,
      createdById: context.user.id,
      name: input.name,
      category: input.category,
      address: input.address ?? null,
      city: input.city ?? null,
    },
    select: { id: true, name: true, category: true, city: true },
  });
}

export async function toggleFavorite(placeId: string): Promise<boolean> {
  const { resource } = await authorizePlace(placeId);
  const next = !resource.isFavorite;
  await prisma.place.update({ where: { id: resource.id }, data: { isFavorite: next } });
  return next;
}

/** Save an external/custom result, then mark it a favourite (used from Explore's heart). */
export async function saveAndFavorite(input: SelectPlaceInput): Promise<PlaceSummary & { isFavorite: boolean }> {
  const context = await requireCoupleContext();
  const summary = await resolvePlace(context, input);
  await prisma.place.update({ where: { id: summary.id }, data: { isFavorite: true } });
  return { ...summary, isFavorite: true };
}

// --- attach to a Date --------------------------------------------------------

export async function setDatePlannedPlace(
  dateId: string,
  input: SelectPlaceInput,
): Promise<PlaceSummary> {
  const { context, resource } = await authorizeDate(dateId);
  const place = await resolvePlace(context, input);
  if (resource.plannedPlaceId !== place.id) {
    await prisma.date.update({ where: { id: resource.id }, data: { plannedPlaceId: place.id } });
    await logDateEvent(
      resource.id,
      context.user.id,
      "PLACE_CHANGED",
      `set the place to ${place.name}`,
    );
  }
  return place;
}

export async function clearDatePlannedPlace(dateId: string): Promise<void> {
  const { context, resource } = await authorizeDate(dateId);
  if (resource.plannedPlaceId) {
    await prisma.date.update({ where: { id: resource.id }, data: { plannedPlaceId: null } });
    await logDateEvent(resource.id, context.user.id, "PLACE_CHANGED", "removed the place");
  }
}

export async function setActivityPlace(
  dateId: string,
  activityId: string,
  savedPlaceId: string | null,
): Promise<void> {
  const { context, resource } = await authorizeDate(dateId);
  if (savedPlaceId) {
    const place = await prisma.place.findFirst({
      where: { id: savedPlaceId, coupleId: context.couple.id, deletedAt: null },
      select: { id: true },
    });
    if (!place) throw new NotFoundError("That place isn't in your list.");
  }
  const result = await prisma.dateActivity.updateMany({
    where: { id: activityId, dateId: resource.id, kind: "PLANNED" },
    data: { placeId: savedPlaceId },
  });
  if (result.count === 0) throw new NotFoundError("That activity isn't on this date.");
}

// --- detail + couple intelligence ----------------------------------------

export interface PlaceDetailView {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  openingText: string | null;
  externalRating: number | null;
  externalRatingCount: number | null;
  priceLevel: number | null;
  isFavorite: boolean;

  gallery: string[];
  history: {
    visitCount: number;
    coupleScore10: number | null;
    lastRevisit: RevisitChoice | null;
    lastRevisitReason: string | null;
    dates: { id: string; title: string; completedAt: string | null; score10: number | null }[];
  };
  intelligence: {
    isFavoriteCategory: boolean;
    favoriteCategoryLabel: string | null;
    similarLiked: { id: string; name: string; score10: number | null }[];
    relevance: string | null;
  };
}

export async function getPlaceDetail(placeId: string): Promise<PlaceDetailView> {
  const { context, resource } = await authorizePlace(placeId);
  const coupleId = context.couple.id;

  const [datesHere, historyMap, sameCategory] = await Promise.all([
    prisma.date.findMany({
      where: {
        coupleId,
        deletedAt: null,
        status: DateStatus.COMPLETED,
        OR: [{ plannedPlaceId: placeId }, { actualPlaceId: placeId }],
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        title: true,
        completedAt: true,
        reviews: { where: { submittedAt: { not: null } }, select: { overallRating: true } },
        revisitDecision: { select: { choice: true, reason: true } },
        photos: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
          take: 4,
          select: { thumbKey: true, storageKey: true },
        },
      },
    }),
    getPlaceHistoryMap(coupleId),
    prisma.place.findMany({
      where: { coupleId, deletedAt: null, category: resource.category, id: { not: placeId } },
      select: { id: true, name: true },
      take: 30,
    }),
  ]);

  const allScores = datesHere.flatMap((date) =>
    date.reviews.map((r) => r.overallRating).filter((n): n is number => n != null),
  );
  const coupleScore10 =
    allScores.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
      : null;
  const lastRevisitDate = datesHere.find((date) => date.revisitDecision);

  // favourite category = the couple's most-visited completed category
  const categoryTally = new Map<PlaceCategory, number>();
  const completedByCategory = await prisma.date.findMany({
    where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
    select: {
      actualPlace: { select: { category: true } },
      plannedPlace: { select: { category: true } },
    },
  });
  for (const date of completedByCategory) {
    const category = date.actualPlace?.category ?? date.plannedPlace?.category;
    if (category) categoryTally.set(category, (categoryTally.get(category) ?? 0) + 1);
  }
  const favoriteCategory =
    [...categoryTally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    null;

  const similarLiked = sameCategory
    .map((place) => ({ id: place.id, name: place.name, score10: score10(historyMap.get(place.id)) }))
    .filter((place) => (place.score10 ?? 0) >= 7)
    .sort((a, b) => (b.score10 ?? 0) - (a.score10 ?? 0))
    .slice(0, 3);

  const relevance =
    datesHere.length > 0 && coupleScore10 != null
      ? `You've been here ${datesHere.length === 1 ? "once" : `${datesHere.length} times`} and rate it ${coupleScore10.toFixed(1)}/10.`
      : favoriteCategory === resource.category
        ? "This is your favourite kind of date."
        : null;

  return {
    id: resource.id,
    name: resource.name,
    category: resource.category,
    address: resource.address,
    city: resource.city,
    latitude: resource.latitude,
    longitude: resource.longitude,
    imageUrl: resource.imageUrl,
    description: resource.description,
    website: resource.website,
    phone: resource.phone,
    openingText: resource.openingText,
    externalRating: resource.externalRating,
    externalRatingCount: resource.externalRatingCount,
    priceLevel: resource.priceLevel,
    isFavorite: resource.isFavorite,
    gallery: datesHere
      .flatMap((date) =>
        date.photos.map((photo) => storage.publicUrl(photo.thumbKey ?? photo.storageKey)),
      )
      .slice(0, 8),
    history: {
      visitCount: datesHere.length,
      coupleScore10,
      lastRevisit: lastRevisitDate?.revisitDecision?.choice ?? null,
      lastRevisitReason: lastRevisitDate?.revisitDecision?.reason ?? null,
      dates: datesHere.slice(0, 5).map((date) => {
        const overalls = date.reviews
          .map((r) => r.overallRating)
          .filter((n): n is number => n != null);
        return {
          id: date.id,
          title: date.title,
          completedAt: date.completedAt?.toISOString() ?? null,
          score10:
            overalls.length > 0
              ? Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10
              : null,
        };
      }),
    },
    intelligence: {
      isFavoriteCategory: favoriteCategory === resource.category,
      favoriteCategoryLabel: favoriteCategory,
      similarLiked,
      relevance,
    },
  };
}

export async function listSavedPlaces(): Promise<PlaceSummary[]> {
  const { couple } = await requireCoupleContext();
  return prisma.place.findMany({
    where: { coupleId: couple.id, deletedAt: null },
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, city: true },
  });
}
