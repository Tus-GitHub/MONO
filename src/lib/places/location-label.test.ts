import { afterEach, expect, it, vi } from "vitest";
import { getLocationLabel } from "./location-label";
afterEach(() => vi.unstubAllGlobals());
const point = { latitude: 28.6, longitude: 77.2 };
it("uses a readable area returned by the private lookup endpoint", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ label: "New Delhi, Delhi, India" }));
  vi.stubGlobal("fetch", fetcher);
  expect(await getLocationLabel(point, new AbortController().signal)).toBe("New Delhi, Delhi, India");
  expect(fetcher.mock.calls[0][0]).toBe("/api/places/locations?lat=28.6&lng=77.2");
});
it.each([null, {}, { label: "" }])("keeps usable coordinates when the area lookup returns %j", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  expect(await getLocationLabel(point, new AbortController().signal)).toBe("28.600, 77.200");
});
it("keeps usable coordinates after network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  expect(await getLocationLabel(point, new AbortController().signal)).toBe("28.600, 77.200");
});
