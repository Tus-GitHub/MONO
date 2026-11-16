import { env, placeProviderConfigured } from "@/config/env";
import { GooglePlacesProvider } from "@/lib/places/google-provider";
import { PhotonPlacesProvider } from "@/lib/places/photon-provider";
import { IndiaRestrosProvider, supportsIndiaRestros } from "@/lib/places/indiarestros-provider";
import type { PlaceProvider, PlaceSearchQuery } from "@/lib/places/types";

export type { PlaceProvider, PlaceSearchQuery, ProviderPlace } from "@/lib/places/types";
const photon = new PhotonPlacesProvider();
const india = new IndiaRestrosProvider();

/** The configured external provider, or `null` (MONO then searches only its own saved places). */
export function getExternalPlaceProvider(query?: Pick<PlaceSearchQuery, "near" | "category">): PlaceProvider | null {
  if (env.PLACE_PROVIDER === "photon") return query && supportsIndiaRestros(query.category, query.near) ? india : photon;
  if (env.PLACE_PROVIDER === "google" && env.GOOGLE_PLACES_API_KEY) {
    return new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY);
  }
  return null;
}

/** Resolve only configured, supported sources; never fetch a client-supplied URL. */
export function getPlaceProviderByName(name: string): PlaceProvider | null {
  if (env.PLACE_PROVIDER === "photon" && name === "indiarestros") return india;
  const provider = getExternalPlaceProvider();
  return provider?.name === name ? provider : null;
}

export { placeProviderConfigured };
