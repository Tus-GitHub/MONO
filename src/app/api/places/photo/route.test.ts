import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn(), env: { GOOGLE_PLACES_API_KEY: "private", PLACE_PROVIDER: "google" } }));
vi.mock("@/config/env", () => ({ env: mocks.env }));
vi.mock("@/lib/authz", () => ({ requireCoupleContext: mocks.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: () => ({ ok: true }) }));
import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.PLACE_PROVIDER = "google";
  mocks.auth.mockResolvedValue({ user: { id: "user" } });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it("requires authentication before making paid provider calls", async () => {
  mocks.auth.mockRejectedValue(new AuthenticationError());
  expect((await GET(new Request("https://mono.test/api/places/photo?placeId=id"))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("makes no Google calls when the keyless provider is selected", async () => {
  mocks.env.PLACE_PROVIDER = "photon";
  expect((await GET(new Request("https://mono.test/api/places/photo?placeId=id"))).status).toBe(503);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("rejects arbitrary paths", async () => {
  expect((await GET(new Request("https://mono.test/api/places/photo?placeId=../other"))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("redirects to a fresh image URI without disclosing the key", async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ photos: [{ name: "places/id/photos/ref" }] }))
    .mockResolvedValueOnce(Response.json({ photoUri: "https://lh3.googleusercontent.com/photo" }));
  const result = await GET(new Request("https://mono.test/api/places/photo?placeId=id"));
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe("https://lh3.googleusercontent.com/photo");
  expect(result.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects unexpected redirect hosts", async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ photos: [{ name: "places/id/photos/ref" }] }))
    .mockResolvedValueOnce(Response.json({ photoUri: "https://evil.test/photo" }));
  expect((await GET(new Request("https://mono.test/api/places/photo?placeId=id"))).status).toBe(502);
});
