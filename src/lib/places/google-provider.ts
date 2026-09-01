import { PlaceCategory } from "@prisma/client";

import type { PlaceProvider, PlaceSearchQuery, ProviderPlace } from "@/lib/places/types";

/**
 * Google Places (new) provider. Wired for `places:searchText` / `places/{id}` but only runs
 * when `GOOGLE_PLACES_API_KEY` is set; any failure degrades to an empty result so the caller
 * can fall back to MONO's own saved places.
 */
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_FIELDS =
  "id,displayName,formattedAddress,location,types,rating,userRatingCount,priceLevel,websiteUri,internationalPhoneNumber,currentOpeningHours,editorialSummary,photos";

const TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  restaurant: PlaceCategory.RESTAURANT,
  cafe: PlaceCategory.CAFE,
  coffee_shop: PlaceCategory.CAFE,
  bar: PlaceCategory.BAR,
  night_club: PlaceCategory.BAR,
  park: PlaceCategory.PARK,
  national_park: PlaceCategory.PARK,
  movie_theater: PlaceCategory.CINEMA,
  museum: PlaceCategory.MUSEUM,
  art_gallery: PlaceCategory.MUSEUM,
  tourist_attraction: PlaceCategory.ACTIVITY,
  amusement_park: PlaceCategory.ACTIVITY,
  shopping_mall: PlaceCategory.SHOPPING,
  store: PlaceCategory.SHOPPING,
  lodging: PlaceCategory.TRAVEL,
};

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  currentOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text?: string };
  photos?: { name?: string }[];
}

const PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function mapPlace(place: GooglePlace, apiKey: string): ProviderPlace {
  const category =
    place.types?.map((type) => TYPE_TO_CATEGORY[type]).find(Boolean) ?? PlaceCategory.OTHER;
  const address = place.formattedAddress ?? null;
  const photoName = place.photos?.[0]?.name;
  return {
    provider: "google",
    providerPlaceId: place.id,
    name: place.displayName?.text ?? "Unnamed place",
    category,
    address,
    city: address ? (address.split(",").slice(-2, -1)[0]?.trim() ?? null) : null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    imageUrl: photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`
      : null,
    description: place.editorialSummary?.text ?? null,
    website: place.websiteUri ?? null,
    phone: place.internationalPhoneNumber ?? null,
    openingText: place.currentOpeningHours?.weekdayDescriptions?.join(" · ") ?? null,
    externalRating: place.rating ?? null,
    externalRatingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ? (PRICE_LEVEL[place.priceLevel] ?? null) : null,
  };
}

export class GooglePlacesProvider implements PlaceProvider {
  readonly name = "google";

  constructor(private readonly apiKey: string) {}

  async search(query: PlaceSearchQuery): Promise<ProviderPlace[]> {
    const textQuery = [query.text, query.category, query.city].filter(Boolean).join(" ").trim();
    if (!textQuery) return [];
    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": `places.${DETAILS_FIELDS.split(",").join(",places.")}`,
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: Math.min(query.limit ?? 12, 20),
          ...(query.near
            ? {
                locationBias: {
                  circle: {
                    center: { latitude: query.near.latitude, longitude: query.near.longitude },
                    radius: 20000,
                  },
                },
              }
            : {}),
        }),
        cache: "no-store",
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { places?: GooglePlace[] };
      return (data.places ?? []).map((place) => mapPlace(place, this.apiKey));
    } catch {
      return [];
    }
  }

  async details(providerPlaceId: string): Promise<ProviderPlace | null> {
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(providerPlaceId)}`,
        {
          headers: {
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": DETAILS_FIELDS,
          },
          cache: "no-store",
        },
      );
      if (!response.ok) return null;
      return mapPlace((await response.json()) as GooglePlace, this.apiKey);
    } catch {
      return null;
    }
  }
}
