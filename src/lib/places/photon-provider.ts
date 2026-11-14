import { PlaceCategory } from "@prisma/client";
import type { PlaceProvider, PlaceSearchQuery, ProviderPlace } from "./types";
import { NEARBY_RADIUS_KM } from "./types";

const ORIGIN = "https://photon.komoot.io";
const TAGS: Partial<Record<PlaceCategory, string[]>> = {
  RESTAURANT: ["amenity.restaurant", "amenity.fast_food", "amenity.food_court"],
  CAFE: ["amenity.cafe", "amenity.ice_cream"], BAR: ["amenity.bar", "amenity.pub", "amenity.biergarten"],
  PARK: ["leisure.park", "leisure.garden", "leisure.nature_reserve", "natural.beach"],
  CINEMA: ["amenity.cinema"], MUSEUM: ["tourism.museum", "tourism.gallery"],
  ACTIVITY: ["tourism.attraction", "amenity.theatre", "leisure.sports_centre", "leisure.bowling_alley", "leisure.water_park", "leisure.amusement_arcade", "leisure.escape_game", "tourism.theme_park"],
  SHOPPING: ["shop"], TRAVEL: ["tourism.hotel", "tourism.guest_house", "tourism.camp_site"],
};
interface Feature {
  properties?: { osm_type?: string; osm_id?: number; osm_key?: string; osm_value?: string;
    name?: string; street?: string; housenumber?: string; district?: string; city?: string;
    county?: string; state?: string; postcode?: string; country?: string };
  geometry?: { type?: string; coordinates?: number[] };
}
function coordinates(feature: Feature): { latitude: number; longitude: number } | null {
  const c = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== "Point" || !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return null;
  return { longitude: c[0], latitude: c[1] };
}
function categoryFor(key: string, value: string): PlaceCategory | null {
  if (key === "shop") return PlaceCategory.SHOPPING;
  return Object.entries(TAGS).find(([, tags]) => tags.includes(`${key}.${value}`))?.[0] as PlaceCategory | undefined ?? null;
}
function mapPlace(feature: Feature): ProviderPlace | null {
  const p = feature?.properties, point = coordinates(feature);
  if (!p || !point || typeof p.name !== "string" || !p.name.trim() || !/^[NWR]$/.test(p.osm_type ?? "") || !Number.isSafeInteger(p.osm_id) || p.osm_id! <= 0
    || !/^[a-z_]{1,32}$/.test(p.osm_key ?? "") || !/^[a-z0-9_]{1,64}$/.test(p.osm_value ?? "")) return null;
  const category = categoryFor(p.osm_key!, p.osm_value!);
  if (!category) return null; // Do not offer city/address geocoding matches as venues.
  const address = [[p.housenumber, p.street].filter(Boolean).join(" "), p.district, p.city ?? p.county, p.state, p.postcode, p.country]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  return {
    provider: "photon", providerPlaceId: `${p.osm_type}${p.osm_id}:${point.latitude.toFixed(7)}:${point.longitude.toFixed(7)}:${p.osm_key}:${p.osm_value}`,
    name: p.name.trim().slice(0, 160), category, address: [...new Set(address)].join(", ") || null,
    city: p.city ?? p.county ?? null, ...point,
    imageUrl: null, description: null, website: null, phone: null, openingText: null,
    externalRating: null, externalRatingCount: null, priceLevel: null,
  };
}
const AREA_QUERY = /^(caf[eé]s?|coffee(?: shops?)?|restaurants?|bars?|pubs?|parks?|museums?|cinemas?|activities|adventures?|shops?|hotels?|places?)\s+(?:in|near|around)\s+(.+)$/iu;
function wordCategory(word: string): PlaceCategory | null {
  if (/^place/i.test(word)) return null;
  if (/^(caf|coffee)/i.test(word)) return PlaceCategory.CAFE;
  if (/^(bar|pub)/i.test(word)) return PlaceCategory.BAR;
  if (/^park/i.test(word)) return PlaceCategory.PARK;
  if (/^museum/i.test(word)) return PlaceCategory.MUSEUM;
  if (/^cinema/i.test(word)) return PlaceCategory.CINEMA;
  if (/^(activit|adventure)/i.test(word)) return PlaceCategory.ACTIVITY;
  if (/^shop/i.test(word)) return PlaceCategory.SHOPPING;
  if (/^hotel/i.test(word)) return PlaceCategory.TRAVEL;
  return PlaceCategory.RESTAURANT;
}

/** Keyless OSM venue search. Public Photon permits modest project use, without an SLA.
 * The singleton holds only public upstream results; couple-private data is merged elsewhere.
 */
export class PhotonPlacesProvider implements PlaceProvider {
  readonly name = "photon";
  private nextRequest = 0;
  private cache = new Map<string, { until: number; work: Promise<Feature[]> }>();

  private async get(path: string, params: URLSearchParams): Promise<Feature[]> {
    const url = new URL(path, ORIGIN); url.search = params.toString();
    const cached = this.cache.get(url.href);
    if (cached && cached.until > Date.now()) return cached.work;
    const wait = Math.max(0, this.nextRequest - Date.now());
    if (wait > 3000) return []; // Avoid a backlog from search-as-you-type bursts.
    this.nextRequest = Date.now() + wait + 1000;
    const work = (async () => {
      try {
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        const response = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "MONO/1.0 (+https://mono-kappa-beryl.vercel.app)" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return [];
        const data = await response.json() as { features?: Feature[] };
        return Array.isArray(data.features) ? data.features : [];
      } catch { return []; }
    })();
    if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(url.href, { until: Date.now() + 5 * 60_000, work });
    return work;
  }
  private parameters(category: PlaceCategory | null | undefined, limit: number): URLSearchParams {
    const params = new URLSearchParams({ limit: String(limit), lang: "en" });
    const tags = !category || category === PlaceCategory.OTHER
      ? [...new Set(Object.values(TAGS).flatMap((tags) => tags ?? []))]
      : TAGS[category];
    // Photon ORs comma-separated categories; repeated include parameters mean AND.
    if (tags?.length) params.set("include", tags.map((tag) => `osm.${tag}`).join(","));
    return params;
  }
  async search(query: PlaceSearchQuery): Promise<ProviderPlace[]> {
    const text = query.text?.trim().slice(0, 120) ?? "";
    if (text.length < 2 || query.category === PlaceCategory.HOME) return [];
    const limit = Math.min(Math.max(query.limit ?? 12, 1), 20);
    const area = text.match(AREA_QUERY);
    let category: PlaceCategory | null | undefined = query.category;
    let features: Feature[];
    if (area) {
      category ??= wordCategory(area[1]);
      let point = query.near;
      if (!/^(me|here)$/i.test(area[2].trim())) {
        // Some installations classify large cities outside layer=city (live Jaipur did).
        // Keep upstream relevance, but never mistake a same-named venue for a city/area.
        const places = await this.get("/api/", new URLSearchParams({ q: area[2].trim(), limit: "5", lang: "en" }));
        const location = places.find((place) => coordinates(place) && (
          (place.properties?.osm_key === "place" && ["city", "town", "village", "hamlet", "suburb", "quarter", "neighbourhood"].includes(place.properties.osm_value ?? ""))
          || (place.properties?.osm_key === "boundary" && place.properties.osm_value === "administrative")
        ));
        point = location ? coordinates(location) : null;
      }
      if (!point) return [];
      const params = this.parameters(category, limit);
      params.set("lat", String(point.latitude)); params.set("lon", String(point.longitude)); params.set("radius", String(NEARBY_RADIUS_KM));
      features = await this.get("/reverse", params);
    } else {
      const params = this.parameters(category, limit);
      params.set("q", [text, query.city].filter(Boolean).join(" "));
      if (query.near) { params.set("lat", String(query.near.latitude)); params.set("lon", String(query.near.longitude)); }
      features = await this.get("/api/", params);
    }
    const results = features.map(mapPlace).filter((place): place is ProviderPlace => place !== null && (!category || category === PlaceCategory.OTHER || place.category === category));
    return [...new Map(results.map((place) => [place.providerPlaceId, place])).values()].slice(0, limit);
  }
  async details(id: string): Promise<ProviderPlace | null> {
    if (id.length > 200) return null;
    const parts = id.match(/^([NWR])([1-9]\d{0,15}):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):([a-z_]{1,32}):([a-z0-9_]{1,64})$/);
    if (!parts) return null;
    const [, type, osmId, latitude, longitude, key, value] = parts;
    if (!Number.isSafeInteger(Number(osmId)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180 || !categoryFor(key, value)) return null;
    const params = new URLSearchParams({ lat: latitude, lon: longitude, radius: "0.5", limit: "20", lang: "en", include: `osm.${key}.${value}`, dedupe: "0" });
    const features = await this.get("/reverse", params);
    // Never save a nearby venue if the selected OSM object was not returned.
    const selected = features.find((feature) => feature?.properties?.osm_type === type && String(feature.properties.osm_id) === osmId && feature.properties.osm_key === key && feature.properties.osm_value === value);
    return selected ? mapPlace(selected) : null;
  }
}
