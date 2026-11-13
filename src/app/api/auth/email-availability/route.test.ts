import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ limit: vi.fn(), available: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: mocks.limit, MINUTE: 60000 }));
vi.mock("@/server/services/email-availability-service", () => ({ isRegistrationEmailAvailable: mocks.available }));
import { POST } from "./route";

function request(body = JSON.stringify({ email: "person@example.com" }), headers: Record<string, string> = {}) {
  return new Request("https://mono.test/api/auth/email-availability", {
    method: "POST", headers: { origin: "https://mono.test", "content-type": "application/json", ...headers }, body,
  });
}
beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue(null); mocks.available.mockResolvedValue(true); });

it("normalizes whitespace/case and returns only a noncached boolean without putting email in the URL", async () => {
  const req = request(JSON.stringify({ email: " Person@Example.COM " }));
  const response = await POST(req);
  expect(req.url).not.toContain("@");
  expect(mocks.available).toHaveBeenCalledWith("person@example.com");
  expect(await response.json()).toEqual({ available: true });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("reports registered addresses without exposing account data", async () => {
  mocks.available.mockResolvedValue(false);
  expect(await (await POST(request())).json()).toEqual({ available: false });
});
it("rejects malformed/empty email before querying accounts", async () => {
  for (const email of ["", "person", "person@", "@example.com", "a".repeat(321) + "@example.com"]) {
    expect((await POST(request(JSON.stringify({ email })))).status).toBe(400);
  }
  expect(mocks.available).not.toHaveBeenCalled();
});
it("rejects cross-origin probes", async () => {
  expect((await POST(request(undefined, { origin: "https://other.test" }))).status).toBe(403);
  expect((await POST(request(undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  expect(mocks.available).not.toHaveBeenCalled();
});
it("bounds JSON input and rejects invalid JSON/content types", async () => {
  expect((await POST(request("{"))).status).toBe(422);
  expect((await POST(request("x".repeat(2049)))).status).toBe(413);
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415);
  expect(mocks.available).not.toHaveBeenCalled();
});
it("rate limits repeated probes before the database query", async () => {
  mocks.limit.mockResolvedValue("Slow down.");
  expect((await POST(request())).status).toBe(429);
  expect(mocks.available).not.toHaveBeenCalled();
});
it("never claims availability or leaks database details during an outage", async () => {
  mocks.available.mockRejectedValue(new Error("private database details"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Email availability is temporarily unavailable." });
});
