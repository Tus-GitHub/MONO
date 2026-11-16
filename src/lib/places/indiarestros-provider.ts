import { PlaceCategory } from "@prisma/client";
import { haversineKm } from "@/lib/utils/geo";
import { indiaRestrosPhoto, indiaRestrosListingUrl } from "./indiarestros-photos";
import { venueRadius, type GeoPoint, type PlaceProvider, type PlaceSearchQuery, type ProviderPlace } from "./types";

const ORIGIN = "https://indiarestros.com";
const KIND = { CAFE: "cafe", RESTAURANT: "restaurant", BAR: "bar" } as const;
const ID = /^IRR-[A-Z0-9]{10}$/;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 500): string | null => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Region prefilter only. Every returned venue must still be inside the requested circle. */
export function supportsIndiaRestros(category: PlaceCategory | null | undefined, near?: GeoPoint | null): boolean {
  return Boolean(category && category in KIND && near && near.latitude >= 6 && near.latitude <= 38 && near.longitude >= 68 && near.longitude <= 98);
}

function publicRating(value: unknown) {
  const row = object(value);
  const source = text(row.src, 40)?.toLowerCase();
  if (!number(row.value) || row.value <= 0 || row.value > 5 || !source || !/^[a-z][a-z0-9_-]*$/.test(source)) return null;
  return { externalRating: row.value, externalRatingCount: Number.isSafeInteger(row.count) && Number(row.count) >= 0 && Number(row.count) <= 2_147_483_647 ? Number(row.count) : null, externalRatingSource: source };
}

/** List and detail endpoints have different address/rating envelopes. Neither is trusted. */
export function parseIndiaRestrosPlace(value: unknown): ProviderPlace | null {
  const row = object(value);
  const id = text(row.id, 30), name = text(row.name, 160);
  if (!id || !ID.test(id) || !name || !number(row.lat) || !number(row.lon) || Math.abs(row.lat) > 90 || Math.abs(row.lon) > 180) return null;
  const category = row.kind === "cafe" ? PlaceCategory.CAFE : ["bar", "pub"].includes(String(row.kind)) ? PlaceCategory.BAR
    : ["restaurant", "dhaba", "fast-food", "food-court", "bakery", "sweets", "cloud-kitchen"].includes(String(row.kind)) ? PlaceCategory.RESTAURANT : null;
  if (!category) return null;
  const sourceUrl = indiaRestrosListingUrl(row.url, id);
  if (!sourceUrl) return null;
  const address = object(row.address);
  const addressText = text(row.address) ?? [address.street, address.locality, address.city, address.state, address.pincode].map((v) => text(v)).filter(Boolean).join(", ").slice(0, 500);
  const ratings = Array.isArray(row.ratings_external) ? row.ratings_external : object(row.ratings).external;
  const rating = publicRating(row.rating_external) ?? (Array.isArray(ratings) ? ratings.map(publicRating).find(Boolean) : null);
  const photo = indiaRestrosPhoto({ id, url: sourceUrl, address: addressText, photos: Array.isArray(row.photos) ? row.photos : [] });
  let website: string | null = null;
  try { const url = new URL(text(row.website) ?? text(object(row.website).v) ?? ""); if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) website = url.href; } catch { /* Optional public website. */ }
  return {
    provider: "indiarestros", providerPlaceId: id, name, category,
    address: addressText || null, city: text(row.city, 120) ?? text(address.city, 120), latitude: row.lat, longitude: row.lon,
    imageUrl: photo?.url ?? null, externalUrl: sourceUrl, description: null, website,
    phone: text(row.phone, 80) ?? (Array.isArray(row.phones) ? text(object(row.phones[0]).v, 80) : null),
    openingText: text(row.hours) ?? text(object(row.hours).raw),
    externalRating: rating?.externalRating ?? null, externalRatingCount: rating?.externalRatingCount ?? null,
    externalRatingSource: rating?.externalRatingSource ?? null,
    priceLevel: Number.isInteger(row.price_band) && Number(row.price_band) >= 0 && Number(row.price_band) <= 4 ? Number(row.price_band) : null,
  };
}

/** Keyless public dataset: one page per click, shared public-response cache and Retry-After backoff. */
export class IndiaRestrosProvider implements PlaceProvider {
  readonly name = "indiarestros";
  private cache = new Map<string, { until: number; value: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  private retryAt = 0;

  private async json(url: URL): Promise<unknown> {
    const key = url.href, cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (Date.now() < this.retryAt) throw new Error("Venue source is busy. Try again shortly.");
    const request = (async () => {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "MONO/1.0 (+https://mono-kappa-beryl.vercel.app)" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          const retry = response.headers.get("Retry-After") ?? "";
          const delay = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
          this.retryAt = Date.now() + Math.max(60_000, Number.isFinite(delay) ? delay : 0);
        }
        throw new Error("Couldn't load the venue source.");
      }
      const value: unknown = await response.json();
      const control = response.headers.get("Cache-Control") ?? "";
      const ttl = /no-store|no-cache/i.test(control) ? 0 : Math.min(Number(control.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 300), 3600) * 1000;
      if (ttl) {
        if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { until: Date.now() + ttl, value });
      }
      return value;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  async searchPage(query: PlaceSearchQuery) {
    if (!supportsIndiaRestros(query.category, query.near)) return { results: [], nextOffset: null };
    const offset = query.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error("Invalid venue page.");
    const radius = venueRadius(query.radiusKm);
    const url = new URL("/api/v1/restaurants", ORIGIN);
    url.search = new URLSearchParams({ lat: String(query.near!.latitude), lon: String(query.near!.longitude), radius_m: String(radius * 1000),
      kind: KIND[query.category as keyof typeof KIND], limit: String(Math.min(50, Math.max(1, query.limit ?? 24))), offset: String(offset),
      ...(query.text?.trim() ? { q: query.text.trim().slice(0, 120) } : {}) }).toString();
    const body = object(await this.json(url));
    if (!Array.isArray(body.results)) throw new Error("Invalid venue response.");
    const seen = new Set<string>();
    const results = body.results.flatMap((row) => {
      const place = parseIndiaRestrosPlace(row);
      if (!place || place.category !== query.category || seen.has(place.providerPlaceId)) return [];
      place.distanceKm = haversineKm(query.near!, { latitude: place.latitude!, longitude: place.longitude! });
      if (place.distanceKm > radius) return [];
      seen.add(place.providerPlaceId);
      return [place];
    });
    const next = body.next_offset;
    return { results, nextOffset: Number.isSafeInteger(next) && Number(next) > offset && Number(next) <= 1_000_000 ? Number(next) : null };
  }

  async search(query: PlaceSearchQuery) { return (await this.searchPage(query)).results; }

  async details(id: string) {
    if (!ID.test(id)) return null;
    return parseIndiaRestrosPlace(await this.json(new URL(`/api/v1/restaurants/${id}`, ORIGIN)));
  }
}
