import type { PlaceCategory } from "@prisma/client";

export interface GeoPoint { latitude: number; longitude: number }
export const NEARBY_RADIUS_KM = 20;
export const NEARBY_RADII_KM = [1, 5, 10, 20, 50, 100] as const;
export function venueRadius(value?: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.round(value!))) : NEARBY_RADIUS_KM;
}

/**
 * External place-provider contract. MONO's UI and business logic depend only on this shape,
 * so a provider (Google Places, Foursquare, a local dataset …) can be added later by
 * implementing `PlaceProvider` — nothing above this layer changes.
 */
export interface PlaceSearchQuery {
  radiusKm?: number;
  /** Free text: place name, area, activity, "coffee near the river", … */
  text?: string;
  category?: PlaceCategory | null;
  /** Bias / filter toward a city or area. */
  city?: string;
  /** Bias toward a point (device location). */
  near?: { latitude: number; longitude: number } | null;
  limit?: number;
}

export interface ProviderPlace {
  distanceKm?: number | null;
  provider: string; // e.g. "google"
  providerPlaceId: string;
  name: string;
  category: PlaceCategory | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  openingText: string | null;
  /** Public rating on a 0–5 scale. */
  externalRating: number | null;
  externalRatingCount: number | null;
  /** 0 (free) – 4 (very expensive). */
  priceLevel: number | null;
}

export interface PlaceProvider {
  readonly name: string;
  resolveArea?(area: string): Promise<GeoPoint | null>;
  search(query: PlaceSearchQuery): Promise<ProviderPlace[]>;
  details(providerPlaceId: string): Promise<ProviderPlace | null>;
}
