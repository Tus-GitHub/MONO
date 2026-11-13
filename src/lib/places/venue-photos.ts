import { IndiaRestrosPhotos } from "./indiarestros-photos";
import { venuePhotos as commons } from "./wikimedia-photos";
import type { PhotoVenue, VenuePhoto } from "./venue-photo";

const india = new IndiaRestrosPhotos();

export async function lookupVenuePhotos(places: PhotoVenue[]): Promise<Map<string, VenuePhoto>> {
  const indian = await india.lookup(places).catch(() => new Map());
  const fallback = await commons.lookup(places.filter((place) => !indian.has(place.providerPlaceId)).map((place) => place.providerPlaceId));
  return new Map<string, VenuePhoto>([...fallback, ...indian]);
}
