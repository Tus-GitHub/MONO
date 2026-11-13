import { beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ user: vi.fn(), limit: vi.fn(), dispatch: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("@/server/services/reminder-service", () => ({ dispatchDueReminders: mocks.dispatch }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { POST } from "./route";

const request = (origin = "https://mono.test") => new Request("https://mono.test/api/reminders/dispatch", {
  method: "POST", headers: { origin }, body: JSON.stringify({ userId: "someone-else" }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "self" });
  mocks.limit.mockReturnValue({ ok: true });
  mocks.dispatch.mockResolvedValue(1);
});
it("dispatches only for the authenticated identity and refreshes data when reminders were delivered", async () => {
  const response = await POST(request());
  expect(mocks.dispatch).toHaveBeenCalledWith("self");
  expect(await response.json()).toEqual({ delivered: 1 });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
});
it("rejects unauthenticated polling", async () => {
  mocks.user.mockRejectedValue(new AuthenticationError());
  expect((await POST(request())).status).toBe(401);
  expect(mocks.dispatch).not.toHaveBeenCalled();
});
it("rejects cross-origin polling before looking up an account", async () => {
  expect((await POST(request("https://other.test"))).status).toBe(403);
  expect(mocks.user).not.toHaveBeenCalled();
});
it("bounds repeated authenticated polling", async () => {
  mocks.limit.mockReturnValue({ ok: false, retryAfterSec: 20 });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("20");
  expect(mocks.dispatch).not.toHaveBeenCalled();
});
it("avoids invalidating the page for an idle poll", async () => {
  mocks.dispatch.mockResolvedValue(0);
  expect(await (await POST(request())).json()).toEqual({ delivered: 0 });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("returns a private generic failure during a provider/database outage", async () => {
  mocks.dispatch.mockRejectedValue(new Error("private details"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Reminders are temporarily unavailable." });
});
