import type { CommonsVenuePhoto as VenuePhoto } from "./venue-photo";

const USER_AGENT = "MONO/1.0 (+https://mono-kappa-beryl.vercel.app)";
const PROPERTIES = { N: "P11693", W: "P10689", R: "P402" } as const;
type Binding = Record<string, { value?: string }>;
type ImageInfo = { thumburl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> };

function osmKey(id: string): string | null {
  const match = id.match(/^([NWR])([1-9]\d{0,15}):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):[a-z_]{1,32}:[a-z0-9_]{1,64}$/);
  return match && Number.isSafeInteger(Number(match[2])) && Math.abs(Number(match[3])) <= 90 && Math.abs(Number(match[4])) <= 180 ? `${match[1]}${match[2]}` : null;
}
function plain(value: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/<[^>]*>/g, " ").replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? "";
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  }).replace(/\s+/g, " ").trim();
}
function photo(info: ImageInfo, title: string): VenuePhoto | null {
  const m = info.extmetadata;
  if (!m || !info.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? "")) return null;
  try {
    const url = new URL(info.thumburl), licenseUrl = new URL(m.LicenseUrl?.value ?? "");
    const author = plain(m.Attribution?.value || m.Artist?.value || ""), license = plain(m.LicenseShortName?.value ?? "");
    if (url.protocol !== "https:" || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname) || !url.pathname.startsWith("/wikipedia/commons/")
      || licenseUrl.protocol !== "https:" || licenseUrl.hostname !== "creativecommons.org"
      || !/^\/(licenses\/(by|by-sa)\/\d\.\d|publicdomain\/(zero|mark)\/1\.0)\/?$/.test(licenseUrl.pathname)
      || !author || author.length > 500 || !license || license.length > 80
      || m.Restrictions?.value || m.NonFree?.value === "true") return null;
    return { url: url.href, sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`, author, license, licenseUrl: licenseUrl.href };
  } catch { return null; }
}

/** Only exact OSM backlinks + Commons images, never fuzzy name/nearby/brand photo matches.
 * Batches public IDs, caches misses as well as hits, and backs off on source throttling.
 */
export class WikimediaVenuePhotos {
  private cache = new Map<string, { until: number; photo: VenuePhoto | null }>();
  private pending: Promise<void> | null = null;
  private nextRequest = 0;

  private async json(url: URL): Promise<unknown> {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      const retry = response.headers.get("Retry-After") ?? "";
      const duration = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
      this.nextRequest = Date.now() + Math.max(60_000, Number.isFinite(duration) ? duration : 0);
      throw new Error("Photo source unavailable");
    }
    return response.json();
  }
  private async load(keys: string[]) {
    const found = new Map<string, VenuePhoto>();
    let ttl = 24 * 60 * 60_000;
    try {
      const groups = Object.entries(PROPERTIES).flatMap(([type, prop]) => {
        const ids = keys.filter((key) => key[0] === type).map((key) => `"${key.slice(1)}"`).join(" ");
        return ids ? [`{ VALUES ?id { ${ids} } ?item wdt:${prop} ?id; wdt:P18 ?image. BIND("${type}" AS ?type) }`] : [];
      });
      const query = `SELECT ?type ?id ?item ?image WHERE { ${groups.join(" UNION ")} } LIMIT 40`;
      const url = new URL("https://query.wikidata.org/sparql");
      url.search = new URLSearchParams({ query, format: "json", timeout: "2500" }).toString();
      const data = await this.json(url) as { results?: { bindings?: Binding[] } };
      if (!Array.isArray(data.results?.bindings)) throw new Error("Invalid source response");
      const files = new Map<string, Set<string>>();
      for (const row of data.results.bindings.slice(0, 40)) {
        const key = `${row.type?.value}${row.id?.value}`;
        if (!keys.includes(key) || !/^https?:\/\/www.wikidata.org\/entity\/Q[1-9]\d*$/.test(row.item?.value ?? "")) continue;
        try {
          const image = new URL(row.image?.value ?? "");
          if (!/^https?:$/.test(image.protocol) || image.hostname !== "commons.wikimedia.org" || !image.pathname.startsWith("/wiki/Special:FilePath/")) continue;
          const name = decodeURIComponent(image.pathname.slice("/wiki/Special:FilePath/".length));
          if (!name || name.length > 240 || /[|\n\r]/.test(name) || !/\.(jpe?g|png|webp)$/i.test(name)) continue;
          const title = `File:${name.replaceAll("_", " ")}`;
          const set = files.get(title) ?? new Set<string>(); set.add(key); files.set(title, set);
        } catch { /* Ignore malformed upstream identifiers. */ }
      }
      if (files.size) {
        const commons = new URL("https://commons.wikimedia.org/w/api.php");
        commons.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "imageinfo", titles: [...files.keys()].join("|"), iiprop: "url|mime|extmetadata", iiurlwidth: "800", maxlag: "5" }).toString();
        const metadata = await this.json(commons) as { query?: { pages?: { title?: string; imageinfo?: ImageInfo[] }[] } };
        if (!Array.isArray(metadata.query?.pages)) throw new Error("Invalid Commons response");
        for (const page of metadata.query.pages) {
          if (!page.title || !files.has(page.title) || !page.imageinfo?.[0]) continue;
          const resolved = photo(page.imageinfo[0], page.title);
          if (resolved) for (const key of files.get(page.title)!) if (!found.has(key)) found.set(key, resolved);
        }
      }
    } catch { ttl = 60_000; this.nextRequest = Math.max(this.nextRequest, Date.now() + ttl); }
    for (const key of keys) {
      if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { until: Date.now() + ttl, photo: found.get(key) ?? null });
    }
  }

  async lookup(ids: string[]): Promise<Map<string, VenuePhoto>> {
    const valid = ids.slice(0, 24).flatMap((id) => { const key = osmKey(id); return key ? [{ id, key }] : []; });
    if (!valid.length) return new Map();
    const missing = [...new Set(valid.filter(({ key }) => (this.cache.get(key)?.until ?? 0) <= Date.now()).map(({ key }) => key))];
    if (missing.length && !this.pending && Date.now() >= this.nextRequest) {
      this.nextRequest = Date.now() + 1000;
      this.pending = this.load(missing).finally(() => { this.pending = null; });
    }
    if (this.pending) await this.pending;
    return new Map(valid.flatMap(({ id, key }) => {
      const cached = this.cache.get(key);
      return cached && cached.until > Date.now() && cached.photo ? [[id, cached.photo] as const] : [];
    }));
  }
}

export const venuePhotos = new WikimediaVenuePhotos();
