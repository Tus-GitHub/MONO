import { haversineKm } from "@/lib/utils/geo";
import type { IndiaRestrosVenuePhoto, PhotoVenue } from "./venue-photo";

const ORIGIN = "https://indiarestros.com";
type Candidate = { id?: string; name?: string; url?: string; address?: string; kind?: string; lat?: number; lon?: number; photo_count?: number;
  photos?: { thumb?: string; alt?: string; kind?: string; representative?: boolean }[] };
type Venue = PhotoVenue & { latitude: number; longitude: number };
const normalize = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim();
function eligible(place: PhotoVenue): place is Venue {
  const match = place.providerPlaceId.match(/^[NWR][1-9]\d{0,15}:(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):[a-z_]+:[a-z0-9_]+$/);
  return Boolean(match && place.latitude != null && place.longitude != null && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    // Broad region prefilter only; a matching Indian API record is still required.
    && place.latitude >= 6 && place.latitude <= 38 && place.longitude >= 68 && place.longitude <= 98
    && Math.abs(Number(match[1]) - place.latitude) < 0.00001 && Math.abs(Number(match[2]) - place.longitude) < 0.00001
    && ["CAFE", "RESTAURANT", "BAR"].includes(place.category ?? "") && normalize(place.name).length >= 3
    && !/^(cafe|coffee|restaurant|food|tea|hotel)$/i.test(normalize(place.name)));
}
function sameName(a: string, b: string): boolean {
  const left = normalize(a), right = normalize(b);
  return right.length >= 3 && !/^(cafe|coffee|restaurant|food|tea|hotel)$/.test(right) && (left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `));
}
function image(candidate: Candidate): IndiaRestrosVenuePhoto | null {
  if (!/^IRR-[A-Z0-9]{10}$/.test(candidate.id ?? "") || !(Number(candidate.photo_count) > 0) || !Array.isArray(candidate.photos)) return null;
  for (const item of candidate.photos.slice(0, 5)) {
    if (!item || item.representative || /representative|illustrat|placeholder|stock/i.test(`${item.alt ?? ""} ${item.kind ?? ""}`)) continue;
    try {
      const url = new URL(item.thumb ?? "", ORIGIN);
      const source = new URL(candidate.url ?? "", ORIGIN);
      if (url.origin !== ORIGIN || url.username || url.password || !new RegExp(`^/img/${candidate.id}/[a-f0-9]{8,64}-(?:480|1200)\\.webp$`).test(url.pathname) || url.search || url.hash) continue;
      if (source.origin !== ORIGIN || source.username || source.password || source.search || source.hash || !new RegExp(`^/r/[a-z0-9-]+-${candidate.id!.slice(4).toLowerCase()}$`).test(source.pathname)) continue;
      return { source: "indiarestros", url: url.href, sourceUrl: source.href,
        ...(typeof candidate.address === "string" && candidate.address.trim() ? { venueAddress: candidate.address.trim().slice(0, 500) } : {}) };
    } catch { /* Ignore malformed public photo URLs. */ }
  }
  return null;
}

/** Keyless India-only enrichment. At most four nearby name groups per batch, with public
 * hit/miss caching and upstream backoff. A name alone never identifies a branch.
 */
export class IndiaRestrosPhotos {
  private cache = new Map<string, { until: number; photo: IndiaRestrosVenuePhoto | null }>();
  private pending: Promise<void> | null = null;
  private nextRequest = 0;
  private key(place: Venue) { return `${place.providerPlaceId}:${normalize(place.name)}`; }

  private async group(places: Venue[]): Promise<void> {
    const center = places[0];
    const radius = Math.ceil(Math.max(1, ...places.map((p) => haversineKm(center, p))) * 1000 + 200);
    const url = new URL("/api/v1/restaurants", ORIGIN);
    url.search = new URLSearchParams({ q: center.name.slice(0, 160), lat: String(center.latitude), lon: String(center.longitude), radius_m: String(radius), limit: "50" }).toString();
    const found = new Map<string, IndiaRestrosVenuePhoto>();
    let ttl = 60_000;
    try {
      const response = await fetch(url, { headers: { "User-Agent": "MONO/1.0 (+https://mono-kappa-beryl.vercel.app)", Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (!response.ok) {
        const retry = response.headers.get("Retry-After") ?? "";
        const delay = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
        this.nextRequest = Math.max(this.nextRequest, Date.now() + Math.max(60_000, Number.isFinite(delay) ? delay : 0));
        throw new Error("Photo source unavailable");
      }
      const control = response.headers.get("Cache-Control") ?? "";
      const maxAge = control.match(/(?:^|,)\s*max-age=(\d+)/i);
      ttl = /no-store|no-cache/i.test(control) ? 0 : Math.min(Number(maxAge?.[1] ?? 3600) * 1000, 24 * 60 * 60_000);
      const data = await response.json() as { results?: Candidate[] };
      if (!Array.isArray(data.results)) throw new Error("Invalid photo response");
      for (const place of places) {
        const candidates = data.results.slice(0, 50).filter((row) => row && typeof row.name === "string" && sameName(place.name, row.name)
          && Number.isFinite(row.lat) && Number.isFinite(row.lon) && Math.abs(row.lat!) <= 90 && Math.abs(row.lon!) <= 180
          && ["cafe", "restaurant", "bar", "pub", "fast-food", "food-court", "dhaba"].includes(row.kind ?? "")
          && (place.category === "CAFE" ? row.kind === "cafe" : row.kind !== "cafe"))
          .map((row) => ({ row, distance: haversineKm(place, { latitude: row.lat!, longitude: row.lon! }) })).filter((row) => row.distance <= 0.12)
          .sort((a, b) => a.distance - b.distance);
        // Two nearby same-name branches are ambiguous unless the closest is clearly nearer.
        if (!candidates[0] || (candidates[1] && candidates[1].distance - candidates[0].distance < 0.05)) continue;
        const resolved = image(candidates[0].row);
        if (resolved) found.set(this.key(place), resolved);
      }
    } catch { ttl = 60_000; this.nextRequest = Math.max(this.nextRequest, Date.now() + ttl); }
    for (const place of places) {
      if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!);
      // A zero max-age is never reused; the coordinator can use Commons instead.
      this.cache.set(this.key(place), { until: Date.now() + ttl, photo: found.get(this.key(place)) ?? null });
    }
  }

  async lookup(input: PhotoVenue[]): Promise<Map<string, IndiaRestrosVenuePhoto>> {
    const places = input.slice(0, 40).filter(eligible);
    if (!places.length) return new Map();
    const missing = places.filter((place) => (this.cache.get(this.key(place))?.until ?? 0) <= Date.now());
    if (missing.length && !this.pending && Date.now() >= this.nextRequest) {
      const groups: Venue[][] = [];
      for (const place of missing) {
        const group = groups.find((group) => normalize(group[0].name) === normalize(place.name) && haversineKm(group[0], place) <= 30);
        if (group) group.push(place); else if (groups.length < 4) groups.push([place]);
      }
      this.nextRequest = Date.now() + 2500;
      this.pending = Promise.all(groups.map((group) => this.group(group))).then(() => {}).finally(() => { this.pending = null; });
    }
    if (this.pending) await this.pending;
    return new Map(places.flatMap((place) => {
      const entry = this.cache.get(this.key(place));
      return entry && entry.until > Date.now() && entry.photo ? [[place.providerPlaceId, entry.photo] as const] : [];
    }));
  }
}
