import { env, placeProviderConfigured } from "@/config/env";
import { GooglePlacesProvider } from "@/lib/places/google-provider";
import type { PlaceProvider } from "@/lib/places/types";

export type { PlaceProvider, PlaceSearchQuery, ProviderPlace } from "@/lib/places/types";

/** The configured external provider, or `null` (MONO then searches only its own saved places). */
export function getExternalPlaceProvider(): PlaceProvider | null {
  if (env.PLACE_PROVIDER === "google" && env.GOOGLE_PLACES_API_KEY) {
    return new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY);
  }
  return null;
}

export { placeProviderConfigured };
