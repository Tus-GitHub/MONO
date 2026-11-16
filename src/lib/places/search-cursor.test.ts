import { expect, it } from "vitest";
import { decodeVenueCursor, encodeVenueCursor, venueSearchKey } from "./search-cursor";
import { mergeVenueResults } from "./merge-search-results";
import type { PlaceSearchResult } from "@/server/services/place-search-service";

it("binds continuation to the couple, category, location, radius and query", () => {
  const key = venueSearchKey(["couple-one", "CAFE", 28.6, 77.4, 50, "coffee"]);
  const cursor = { key, saved: 24, external: 48, provider: "indiarestros" };
  expect(decodeVenueCursor(encodeVenueCursor(cursor), key)).toMatchObject(cursor);
  for (const changed of [["couple-two", "CAFE", 28.6, 77.4, 50, "coffee"], ["couple-one", "CAFE", 28.6, 77.4, 5, "coffee"]]) {
    expect(() => decodeVenueCursor(encodeVenueCursor(cursor), venueSearchKey(changed))).toThrow(/changed/);
  }
});
it.each(["!bad", "a".repeat(601), encodeVenueCursor({ key: "key", saved: -1, external: 24, provider: "indiarestros" }), encodeVenueCursor({ key: "key", saved: 0, external: 24, provider: "arbitrary" })])("rejects malformed cursors", (value) => {
  expect(() => decodeVenueCursor(value, "key")).toThrow();
});
it("appends overlapping pages once without collapsing different same-name outlets", () => {
  const place = (id: string, savedPlaceId: string | null = null) => ({ savedPlaceId, external: { provider: "indiarestros", providerPlaceId: id }, name: "Same chain" } as PlaceSearchResult);
  const first = [place("one", "saved-one"), place("two")];
  const merged = mergeVenueResults(first, [place("two"), place("three"), place("three"), place("four", "saved-one")]);
  expect(merged.map((row) => row.external?.providerPlaceId)).toEqual(["one", "two", "three"]);
  expect(first).toHaveLength(2);
});
