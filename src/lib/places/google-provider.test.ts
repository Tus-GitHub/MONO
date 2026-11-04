import { afterEach, expect, it, vi } from "vitest";
import { GooglePlacesProvider } from "./google-provider";
import { placeImageUrl } from "./image-url";

afterEach(() => vi.unstubAllGlobals());
it("never exposes the provider key in search results", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ places: [{
    id: "place-id", displayName: { text: "Cafe" }, photos: [{ name: "places/place-id/photos/photo" }],
  }] })));
  const results = await new GooglePlacesProvider("private-key").search({ text: "cafe" });
  expect(results[0].imageUrl).toBe("/api/places/photo?placeId=place-id");
  expect(JSON.stringify(results)).not.toContain("private-key");
});
it("rewrites legacy saved photo URLs before returning them to clients", () => {
  expect(placeImageUrl({ provider: "google", providerPlaceId: "id", imageUrl: "https://places.googleapis.com/photo?key=private" }))
    .toBe("/api/places/photo?placeId=id");
});
it("keeps provider outages nonfatal for saved-place search", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  expect(await new GooglePlacesProvider("key").search({ text: "cafe" })).toEqual([]);
});
