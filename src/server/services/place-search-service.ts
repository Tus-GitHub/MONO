import "server-only";

import { placeImageUrl } from "@/lib/places/image-url";
import { lookupVenuePhotos } from "@/lib/places/venue-photos";
import type { VenuePhoto } from "@/lib/places/venue-photo";

import { PlaceCategory, RevisitChoice } from "@prisma/client";

import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { getExternalPlaceProvider } from "@/lib/places";
import { getPlaceHistoryMap, score10 } from "@/server/services/place-history";
import { haversineKm } from "@/lib/utils/geo";

export interface PlaceSearchResult {
  /** Present when this is (or matches) a place already saved in MONO. */
  savedPlaceId: string | null;
  external: { provider: string; providerPlaceId: string } | null;

  name: string;
  category: PlaceCategory | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  photo?: VenuePhoto | null;

  externalRating: number | null;
  externalRatingCount: number | null;
  priceLevel: number | null;

  // couple-private signal (aggregate only)
  isFavorite: boolean;
  coupleScore10: number | null;
  visitCount: number;
  lastRevisit: RevisitChoice | null;

  distanceKm: number | null;
}

interface Options {
  text?: string;
  categories?: PlaceCategory[];
  near?: { latitude: number; longitude: number } | null;
  curated?: boolean;
  limit?: number;
}

export async function searchPlaces(options: Options = {}): Promise<PlaceSearchResult[]> {
  const { couple } = await requireCoupleContext();
  const limit = Math.min(options.limit ?? 24, 40);
  const text = options.text?.trim() || undefined;

  const [saved, history] = await Promise.all([
    prisma.place.findMany({
      where: {
        coupleId: couple.id,
        deletedAt: null,
        ...(options.categories && options.categories.length
          ? { category: { in: options.categories } }
          : {}),
        ...(text
          ? {
              OR: [
                { name: { contains: text, mode: "insensitive" } },
                { city: { contains: text, mode: "insensitive" } },
                { address: { contains: text, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    getPlaceHistoryMap(couple.id),
  ]);

  const savedByProviderId = new Map(
    saved.filter((p) => p.provider && p.providerPlaceId).map((p) => [`${p.provider}:${p.providerPlaceId}`, p]),
  );

  const results: PlaceSearchResult[] = saved.map((place) => {
    const entry = history.get(place.id);
    return {
      savedPlaceId: place.id,
      external:
        place.provider && place.providerPlaceId
          ? { provider: place.provider, providerPlaceId: place.providerPlaceId }
          : null,
      name: place.name,
      category: place.category,
      address: place.address,
      city: place.city,
      latitude: place.latitude,
      longitude: place.longitude,
      imageUrl: placeImageUrl(place),
      externalRating: place.externalRating,
      externalRatingCount: place.externalRatingCount,
      priceLevel: place.priceLevel,
      isFavorite: place.isFavorite,
      coupleScore10: score10(entry),
      visitCount: entry?.visits ?? 0,
      lastRevisit: entry?.lastRevisit ?? null,
      distanceKm:
        options.near && place.latitude != null && place.longitude != null
          ? haversineKm(options.near, { latitude: place.latitude, longitude: place.longitude })
          : null,
    };
  });

  // Merge in external provider results (deduped against saved places).
  const provider = getExternalPlaceProvider();
  if (provider && text && !options.curated) {
    const external = await provider
      .search({ text, category: options.categories?.[0] ?? null, near: options.near, limit })
      .catch(() => []);
    for (const place of external) {
      if (savedByProviderId.has(`${place.provider}:${place.providerPlaceId}`)) continue;
      results.push({
        savedPlaceId: null,
        external: { provider: place.provider, providerPlaceId: place.providerPlaceId },
        name: place.name,
        category: place.category,
        address: place.address,
        city: place.city,
        latitude: place.latitude,
        longitude: place.longitude,
        imageUrl: placeImageUrl(place),
        externalRating: place.externalRating,
        externalRatingCount: place.externalRatingCount,
        priceLevel: place.priceLevel,
        isFavorite: false,
        coupleScore10: null,
        visitCount: 0,
        lastRevisit: null,
        distanceKm:
          options.near && place.latitude != null && place.longitude != null
            ? haversineKm(options.near, { latitude: place.latitude, longitude: place.longitude })
            : null,
      });
    }
  }

  const ranked = results.sort((a, b) => {
    if (options.curated) {
      return (b.coupleScore10 ?? -1) - (a.coupleScore10 ?? -1) || a.visitCount - b.visitCount;
    }
    return (
      Number(b.isFavorite) - Number(a.isFavorite) ||
      b.visitCount - a.visitCount ||
      (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
      a.name.localeCompare(b.name)
    );
  });

  const selected = (options.curated ? ranked.filter((r) => r.coupleScore10 != null && !r.isFavorite) : ranked).slice(0, limit);
  const photos = await lookupVenuePhotos(selected.filter((place) => !place.imageUrl && place.external?.provider === "photon").map((place) => ({ ...place, providerPlaceId: place.external!.providerPlaceId })));
  return selected.map((place) => {
    const photo = !place.imageUrl && place.external?.provider === "photon" ? photos.get(place.external.providerPlaceId) : null;
    return photo ? { ...place, imageUrl: photo.url, photo } : place;
  });
}
