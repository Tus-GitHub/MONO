import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaceCategory } from "@prisma/client";
import { PhotonPlacesProvider } from "./photon-provider";

const cafe = { properties: { osm_type: "N", osm_id: 6957678134, osm_key: "amenity", osm_value: "cafe", name: "Starbucks", street: "Dharma Marg", city: "New Delhi", country: "India" }, geometry: { type: "Point", coordinates: [77.1861298, 28.6022338] } };
const collection = (features: unknown[]) => Response.json({ features });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:00:00Z")); fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function settle<T>(work: Promise<T>): Promise<T> { await vi.runAllTimersAsync(); return work; }

it("maps real venue fields without inventing Google ratings, photos or a key", async () => {
  fetcher.mockResolvedValue(collection([cafe]));
  const [place] = await new PhotonPlacesProvider().search({ text: "Starbucks Delhi", category: PlaceCategory.CAFE });
  expect(place).toMatchObject({ provider: "photon", name: "Starbucks", category: "CAFE", latitude: 28.6022338, longitude: 77.1861298, city: "New Delhi", imageUrl: null, externalRating: null, externalRatingCount: null });
  expect(place.address).toContain("Dharma Marg");
  expect(place.providerPlaceId).toBe("N6957678134:28.6022338:77.1861298:amenity:cafe");
  const [url, options] = fetcher.mock.calls[0];
  expect(url.origin).toBe("https://photon.komoot.io"); expect(url.searchParams.getAll("include")).toEqual(["osm.amenity.cafe,osm.amenity.ice_cream"]);
  expect(url.searchParams.has("apiKey")).toBe(false); expect(options.headers["User-Agent"]).toContain("MONO");
});
it("resolves an area before browsing its cafes instead of matching names elsewhere", async () => {
  fetcher.mockResolvedValueOnce(collection([{ properties: { name: "Delhi", osm_key: "place", osm_value: "city" }, geometry: { type: "Point", coordinates: [77.2, 28.6] } }])).mockResolvedValueOnce(collection([cafe]));
  const results = await settle(new PhotonPlacesProvider().search({ text: "cafes in Delhi" }));
  expect(results).toHaveLength(1);
  expect(fetcher.mock.calls[0][0].searchParams.get("layer")).toBe("city");
  const lookup = fetcher.mock.calls[1][0];
  expect(lookup.pathname).toBe("/reverse"); expect(lookup.searchParams.get("lat")).toBe("28.6"); expect(lookup.searchParams.get("lon")).toBe("77.2");
});
it("uses an explicitly supplied near point for cafes near me", async () => {
  fetcher.mockResolvedValue(collection([cafe]));
  await new PhotonPlacesProvider().search({ text: "cafes near me", near: { latitude: 28.6, longitude: 77.2 } });
  expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0].pathname).toBe("/reverse");
});
it("does not guess an area for near-me searches without coordinates", async () => {
  expect(await new PhotonPlacesProvider().search({ text: "cafes near me" })).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
});
it("filters address matches, malformed coordinates, wrong categories and duplicate venues", async () => {
  fetcher.mockResolvedValue(collection([cafe, cafe, { ...cafe, properties: { ...cafe.properties, osm_value: "restaurant" } }, { ...cafe, geometry: { type: "Point", coordinates: [200, 28] } }, { properties: { name: "Delhi", osm_key: "place", osm_value: "city" }, geometry: cafe.geometry }, null]));
  expect(await new PhotonPlacesProvider().search({ text: "Starbucks", category: PlaceCategory.CAFE })).toHaveLength(1);
});
it("coalesces identical public requests and reuses the short-lived cache", async () => {
  fetcher.mockResolvedValue(collection([cafe]));
  const provider = new PhotonPlacesProvider();
  const results = await Promise.all([provider.search({ text: "Starbucks" }), provider.search({ text: "Starbucks" })]);
  expect(results[0]).toEqual(results[1]); expect(fetcher).toHaveBeenCalledTimes(1);
  await provider.search({ text: "Starbucks" }); expect(fetcher).toHaveBeenCalledTimes(1);
});
it("paces distinct requests conservatively", async () => {
  fetcher.mockImplementation(async () => collection([cafe]));
  const provider = new PhotonPlacesProvider();
  await provider.search({ text: "one" });
  const second = provider.search({ text: "two" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000); await second;
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("returns the exact selected object, even if another cafe is first", async () => {
  fetcher.mockResolvedValue(collection([{ ...cafe, properties: { ...cafe.properties, osm_id: 999, name: "Other cafe" } }, cafe]));
  const place = await new PhotonPlacesProvider().details("N6957678134:28.6022338:77.1861298:amenity:cafe");
  expect(place?.name).toBe("Starbucks");
});
it("refuses a nearby substitute when the selected object is missing", async () => {
  fetcher.mockResolvedValue(collection([{ ...cafe, properties: { ...cafe.properties, osm_id: 999 } }]));
  expect(await new PhotonPlacesProvider().details("N6957678134:28.6022338:77.1861298:amenity:cafe")).toBeNull();
});
it.each(["https://other.test", "N1:91:77:amenity:cafe", "N1:28:181:amenity:cafe", "N1:28:77:place:city", "N1:28:77:amenity:cafe?extra=yes"])("rejects malformed or unsafe selection id %s before fetching", async (id) => {
  expect(await new PhotonPlacesProvider().details(id)).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
});
it("keeps network/provider failure nonfatal for saved/custom fallback", async () => {
  fetcher.mockRejectedValue(new Error("timeout"));
  expect(await new PhotonPlacesProvider().search({ text: "Starbucks" })).toEqual([]);
});
it("keeps tiny coordinates in a parseable selection id", async () => {
  fetcher.mockResolvedValue(collection([{ ...cafe, geometry: { type: "Point", coordinates: [0.0000001, 0.0000001] } }]));
  const provider = new PhotonPlacesProvider(); const [place] = await provider.search({ text: "Cafe" });
  expect(place.providerPlaceId).toContain(":0.0000001:0.0000001:");
});
