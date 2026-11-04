/** Never return legacy Google API URLs containing a server key to the browser. */
export function placeImageUrl(place: {
  provider?: string | null;
  providerPlaceId?: string | null;
  imageUrl: string | null;
}): string | null {
  if (place.provider === "google" && place.providerPlaceId && place.imageUrl) {
    return `/api/places/photo?placeId=${encodeURIComponent(place.providerPlaceId)}`;
  }
  return place.imageUrl;
}
