import type { PlaceSearchResult } from "@/server/services/place-search-service";

/** Preserve loaded cards and selections when an upstream page overlaps another page. */
export function mergeVenueResults(current: PlaceSearchResult[], incoming: PlaceSearchResult[]): PlaceSearchResult[] {
  const saved = new Set(current.flatMap((place) => place.savedPlaceId ? [place.savedPlaceId] : []));
  const external = new Set(current.flatMap((place) => place.external ? [`${place.external.provider}:${place.external.providerPlaceId}`] : []));
  const result = [...current];
  for (const place of incoming) {
    const key = place.external ? `${place.external.provider}:${place.external.providerPlaceId}` : null;
    if ((place.savedPlaceId && saved.has(place.savedPlaceId)) || (key && external.has(key))) continue;
    if (place.savedPlaceId) saved.add(place.savedPlaceId);
    if (key) external.add(key);
    result.push(place);
  }
  return result;
}
