import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IndiaRestrosProvider, parseIndiaRestrosPlace, supportsIndiaRestros } from "./indiarestros-provider";

const near = { latitude: 28.6, longitude: 77.4 };
const cafe = { id: "IRR-2DFVGTV5JE", name: "The Gamer Shack India", kind: "cafe", lat: 28.605805, lon: 77.427034,
  city: "Ghaziabad", address: "Ground Floor, Gaur City Center", url: "https://indiarestros.com/r/the-gamer-shack-india-gaur-city-2dfvgtv5je",
  rating_external: { src: "google", value: 4.7, count: 86 }, photos: [{ thumb: "/img/IRR-2DFVGTV5JE/884fc2f0fc87-480.webp" }] };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const page = (results: unknown[], next: number | null = null) => Response.json({ results, next_offset: next }, { headers: { "Cache-Control": "public, max-age=300" } });

it("maps public ratings, their count/source, exact venue photos and the canonical listing", () => {
  expect(parseIndiaRestrosPlace(cafe)).toMatchObject({ provider: "indiarestros", category: "CAFE", externalRating: 4.7,
    externalRatingCount: 86, externalRatingSource: "google", externalUrl: cafe.url, imageUrl: `https://indiarestros.com${cafe.photos[0].thumb}` });
});
it("normalizes the different detail envelope without losing public attribution", () => {
  expect(parseIndiaRestrosPlace({ ...cafe, city: undefined, address: { street: "GF-55", city: "Ghaziabad", state: "Uttar Pradesh" },
    rating_external: undefined, ratings: { external: [cafe.rating_external] }, hours: { raw: "Mo-Su 10:30-22:00" }, phones: [{ v: "+919560200154" }], website: { v: "https://example.com" } }))
    .toMatchObject({ address: "GF-55, Ghaziabad, Uttar Pradesh", city: "Ghaziabad", externalRating: 4.7, externalRatingSource: "google", openingText: "Mo-Su 10:30-22:00", phone: "+919560200154", website: "https://example.com/" });
});
it("does not invent ratings, counts or restaurant photos", () => {
  expect(parseIndiaRestrosPlace({ ...cafe, rating_external: { src: "google", value: 8, count: -1 }, photos: [{ ...cafe.photos[0], representative: true }] }))
    .toMatchObject({ externalRating: null, externalRatingCount: null, externalRatingSource: null, imageUrl: null });
  expect(parseIndiaRestrosPlace({ ...cafe, rating_external: { src: "google", value: 4.2 } })?.externalRatingCount).toBeNull();
});
it.each([{ id: "../secret" }, { lat: 999 }, { name: null }, { url: "https://example.com/r/test-2dfvgtv5je" }, { url: "https://indiarestros.com/r/wrong-0000000000" }])("rejects malformed or unidentifiable listing %j", (change) => {
  expect(parseIndiaRestrosPlace({ ...cafe, ...change })).toBeNull();
});
it("preserves the same radius/query and follows the provider's real next offset", async () => {
  const provider = new IndiaRestrosProvider();
  fetcher.mockResolvedValueOnce(page([cafe], 24)).mockResolvedValueOnce(page([{ ...cafe, id: "IRR-0000000001", url: "https://indiarestros.com/r/farther-cafe-0000000001", lat: 28.9 }], null));
  const first = await provider.searchPage({ near, radiusKm: 50, category: "CAFE", limit: 24 });
  const second = await provider.searchPage({ near, radiusKm: 50, category: "CAFE", limit: 24, offset: first.nextOffset! });
  expect(first.nextOffset).toBe(24); expect(second.nextOffset).toBeNull();
  expect(second.results[0].distanceKm).toBeGreaterThan(30); expect(second.results[0].distanceKm).toBeLessThan(50);
  for (const [url] of fetcher.mock.calls) { expect(url.searchParams.get("radius_m")).toBe("50000"); expect(url.searchParams.has("q")).toBe(false); expect(url.searchParams.get("kind")).toBe("cafe"); }
  expect(fetcher.mock.calls[1][0].searchParams.get("offset")).toBe("24");
});
it("filters wrong categories, duplicates and places outside the actual circle", async () => {
  fetcher.mockResolvedValue(page([cafe, cafe, { ...cafe, lat: 30 }, { ...cafe, kind: "restaurant" }]));
  expect((await new IndiaRestrosProvider().searchPage({ near, radiusKm: 5, category: "CAFE", text: "Gamer" })).results).toHaveLength(1);
  expect(fetcher.mock.calls[0][0].searchParams.get("q")).toBe("Gamer");
});
it("keeps a next cursor for a filtered page and rejects non-advancing offsets", async () => {
  const provider = new IndiaRestrosProvider();
  fetcher.mockResolvedValueOnce(page([{ ...cafe, lat: 30 }], 48)).mockResolvedValueOnce(page([cafe], 48));
  expect(await provider.searchPage({ near, radiusKm: 5, category: "CAFE", offset: 24 })).toEqual({ results: [], nextOffset: 48 });
  expect((await provider.searchPage({ near, radiusKm: 5, category: "CAFE", offset: 48 })).nextOffset).toBeNull();
});
it("caches public pages, coalesces duplicate requests and honors Retry-After", async () => {
  vi.useFakeTimers();
  const provider = new IndiaRestrosProvider(), query = { near, category: "CAFE" as const };
  fetcher.mockResolvedValueOnce(page([cafe], 24));
  await Promise.all([provider.searchPage(query), provider.searchPage(query)]);
  await provider.searchPage(query); expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValueOnce(new Response("Busy", { status: 429, headers: { "Retry-After": "120" } }));
  await expect(provider.searchPage({ ...query, offset: 24 })).rejects.toThrow();
  await expect(provider.searchPage({ ...query, offset: 48 })).rejects.toThrow(/busy/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(120_001); fetcher.mockResolvedValueOnce(page([cafe]));
  await provider.searchPage({ ...query, offset: 24 }); expect(fetcher).toHaveBeenCalledTimes(3);
});
it("keeps non-food/global searches with the existing provider and never fetches an arbitrary detail URL", async () => {
  expect(supportsIndiaRestros("CAFE", near)).toBe(true);
  expect(supportsIndiaRestros("CINEMA", near)).toBe(false);
  expect(supportsIndiaRestros("CAFE", { latitude: 51.5, longitude: -0.1 })).toBe(false);
  expect(await new IndiaRestrosProvider().details("https://example.com/private")).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
