import { beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";
const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), seen: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
vi.mock("@/lib/authz", () => ({ requireCoupleContext: mocks.context }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: mocks.limit, MINUTE: 60000 }));
vi.mock("@/server/services/date-event-service", () => ({ markDateActivitySeen: mocks.seen }));
import { POST } from "./route";
const request = (origin = "https://mono.test") => new Request("https://mono.test/api/activity/seen", {
  method: "POST", headers: { origin }, body: JSON.stringify({ coupleId: "other", userId: "other" }),
});
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue({ user: { id: "self" }, couple: { id: "pair" } }); mocks.limit.mockReturnValue({ ok: true }); });
it("uses only the authenticated couple and member for background activity", async () => {
  const response = await POST(request());
  expect(mocks.seen).toHaveBeenCalledWith("pair", "self");
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects unauthenticated or cross-origin activity", async () => {
  expect((await POST(request("https://other.test"))).status).toBe(403);
  mocks.context.mockRejectedValue(new AuthenticationError());
  expect((await POST(request())).status).toBe(401);
  expect(mocks.seen).not.toHaveBeenCalled();
});
it("rate limits repeated activity updates", async () => {
  mocks.limit.mockReturnValue({ ok: false });
  expect((await POST(request())).status).toBe(429);
  expect(mocks.seen).not.toHaveBeenCalled();
});
it("keeps internal failures private", async () => {
  mocks.seen.mockRejectedValue(new Error("internal details"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Activity is temporarily unavailable." });
});
