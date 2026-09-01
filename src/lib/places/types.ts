import type { PlaceCategory } from "@prisma/client";

/**
 * External place-provider contract. MONO's UI and business logic depend only on this shape,
 * so a provider (Google Places, Foursquare, a local dataset …) can be added later by
 * implementing `PlaceProvider` — nothing above this layer changes.
 */
export interface PlaceSearchQuery {
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
  search(query: PlaceSearchQuery): Promise<ProviderPlace[]>;
  details(providerPlaceId: string): Promise<ProviderPlace | null>;
}
