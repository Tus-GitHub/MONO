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
import { CATEGORY_SEARCH_TEXT, providerCategoryFor } from "@/lib/date/plan-discovery";
import { venueRadius } from "@/lib/places/types";
import { AppError, ValidationError } from "@/lib/errors";
import { decodeVenueCursor, encodeVenueCursor, venueSearchKey } from "@/lib/places/search-cursor";
import { indiaRestrosPhoto } from "@/lib/places/indiarestros-photos";

export interface PlaceSearchResult {
  /** Present when this is (or matches) a place already saved in AMOR. */
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
  externalRatingSource?: string | null;
  externalUrl?: string | null;
  priceLevel: number | null;

  // couple-private signal (aggregate only)
  isFavorite: boolean;
  coupleScore10: number | null;
  visitCount: number;
  lastRevisit: RevisitChoice | null;

  distanceKm: number | null;
}

interface Options {
  radiusKm?: number;
  text?: string;
  city?: string;
  categories?: PlaceCategory[];
  near?: { latitude: number; longitude: number } | null;
  curated?: boolean;
  limit?: number;
  cursor?: string;
}

export async function searchPlaces(options: Options = {}): Promise<PlaceSearchResult[]> {
  return (await searchPlacesPage(options)).results.slice(0, options.limit ?? 24);
}

export interface PlaceSearchPage { results: PlaceSearchResult[]; nextCursor: string | null }

export async function searchPlacesPage(options: Options = {}): Promise<PlaceSearchPage> {
  const { couple } = await requireCoupleContext();
  const radiusKm = venueRadius(options.radiusKm);
  const limit = Math.min(options.limit ?? 24, 40);
  const text = options.text?.trim() || undefined;
  const city = options.city?.trim().slice(0, 80) || undefined;
  const baseProvider = getExternalPlaceProvider();
  const origin = options.near ?? (city && baseProvider?.resolveArea ? await baseProvider.resolveArea(city).catch(() => null) : null);
  const providerCategory = providerCategoryFor(options.categories);
  let provider = getExternalPlaceProvider({ category: providerCategory, near: origin });
  const key = venueSearchKey([couple.id, text, city, options.categories, options.near, radiusKm, limit, Boolean(options.curated)]);
  const cursor = decodeVenueCursor(options.cursor, key);
  if (cursor?.external != null) {
    if (cursor.provider === baseProvider?.name) provider = baseProvider;
    if (cursor.provider !== provider?.name) throw new ValidationError("The venue source changed. Search again.");
  }
  const browseText = providerCategory ? CATEGORY_SEARCH_TEXT[providerCategory] : "places";
  const areaParts = origin ? [] : city?.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 3) ?? [];

  const externalTask = async () => {
    if (!provider || options.curated || !(text || city || options.near) || (cursor && cursor.external === null)) return { results: [], nextOffset: null };
    const query = { text: provider.name === "indiarestros" ? text : text ?? (city ? `${browseText} in ${city}` : `${browseText} near me`),
      city, category: providerCategory, near: origin, radiusKm, limit, ...(cursor ? { offset: cursor.external! } : {}) };
    try {
      const page = provider.searchPage ? await provider.searchPage(query) : { results: await provider.search(query), nextOffset: null };
      // Keep OSM/Commons coverage when the Indian dataset has no matching venue.
      if (!cursor && provider.name === "indiarestros" && !page.results.length && page.nextOffset === null && baseProvider) {
        provider = baseProvider;
        return { results: await provider.search({ ...query, text: text ?? `${browseText} near me` }), nextOffset: null };
      }
      return page;
    } catch { throw new AppError("venue_source_unavailable", "Couldn't load more venues right now. Please try again shortly.", 503); }
  };
  const [saved, history, externalPage] = await Promise.all([
    prisma.place.findMany({
      where: {
        coupleId: couple.id,
        deletedAt: null,
        ...(areaParts.length ? { AND: areaParts.map((part) => ({ OR: [
          { city: { contains: part, mode: "insensitive" as const } },
          { address: { contains: part, mode: "insensitive" as const } },
        ] })) } : {}),
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
    }),
    getPlaceHistoryMap(couple.id),
    externalTask(),
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
      externalRatingSource: place.externalRatingSource ?? (place.provider === "google" ? "google" : null),
      externalUrl: place.externalUrl,
      photo: place.provider === "indiarestros" ? indiaRestrosPhoto({ id: place.providerPlaceId ?? "", url: place.externalUrl ?? "", photos: [{ thumb: place.imageUrl ?? "" }] }) : null,
      priceLevel: place.priceLevel,
      isFavorite: place.isFavorite,
      coupleScore10: score10(entry),
      visitCount: entry?.visits ?? 0,
      lastRevisit: entry?.lastRevisit ?? null,
      distanceKm:
        origin && place.latitude != null && place.longitude != null
          ? haversineKm(origin, { latitude: place.latitude, longitude: place.longitude })
          : null,
    };
  });

  // Each stream advances independently so merging never discards unshown provider rows.
  const externalResults: PlaceSearchResult[] = [];
  const seenExternal = new Set<string>();
    for (const place of externalPage.results) {
      if (options.categories?.length && (!place.category || !options.categories.includes(place.category))) continue;
      if (savedByProviderId.has(`${place.provider}:${place.providerPlaceId}`)) continue;
      const identity = `${place.provider}:${place.providerPlaceId}`;
      if (seenExternal.has(identity)) continue;
      seenExternal.add(identity);
      externalResults.push({
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
        externalRatingSource: place.externalRatingSource ?? (place.provider === "google" ? "google" : null),
        externalUrl: place.externalUrl,
        photo: place.provider === "indiarestros" ? indiaRestrosPhoto({ id: place.providerPlaceId, url: place.externalUrl ?? "", photos: [{ thumb: place.imageUrl ?? "" }] }) : null,
        priceLevel: place.priceLevel,
        isFavorite: false,
        coupleScore10: null,
        visitCount: 0,
        lastRevisit: null,
        distanceKm:
          origin && place.latitude != null && place.longitude != null
            ? haversineKm(origin, { latitude: place.latitude, longitude: place.longitude })
            : place.distanceKm ?? null,
      });
    }

  const inRadius = (place: PlaceSearchResult) => !origin || (place.distanceKm != null && place.distanceKm <= radiusKm);
  const compare = (a: PlaceSearchResult, b: PlaceSearchResult) => {
    if (options.curated) {
      return (b.coupleScore10 ?? -1) - (a.coupleScore10 ?? -1) || a.visitCount - b.visitCount;
    }
    return (
      Number(b.isFavorite) - Number(a.isFavorite) ||
      b.visitCount - a.visitCount ||
      (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
      a.name.localeCompare(b.name)
    );
  };

  const ranked = results.filter(inRadius).filter((r) => !options.curated || (r.coupleScore10 != null && !r.isFavorite)).sort(compare);
  const savedOffset = cursor?.saved ?? 0;
  const savedEnd = Math.min(ranked.length, savedOffset + limit);
  const selected = [...ranked.slice(savedOffset, savedEnd), ...externalResults.filter(inRadius)].sort(compare);
  const nextCursor = savedEnd < ranked.length || externalPage.nextOffset != null
    ? encodeVenueCursor({ key, saved: savedEnd, external: externalPage.nextOffset, provider: provider?.name ?? null }) : null;
  const photos = await lookupVenuePhotos(selected.filter((place) => !place.imageUrl && place.external?.provider === "photon").map((place) => ({ ...place, providerPlaceId: place.external!.providerPlaceId })));
  return { nextCursor, results: selected.map((place) => {
    const photo = !place.imageUrl && place.external?.provider === "photon" ? photos.get(place.external.providerPlaceId) : null;
    return photo ? { ...place, imageUrl: photo.url, photo,
      address: photo.source === "indiarestros" ? photo.venueAddress ?? place.address : place.address } : place;
  }) };
}
