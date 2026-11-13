import { beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError, ValidationError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ user: vi.fn(), remember: vi.fn(), confirm: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/auth/pending-invitation", () => ({ rememberInvitation: mocks.remember }));
vi.mock("@/server/services/email-verification-service", () => ({ completeEmailVerification: mocks.confirm }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: mocks.limit, MINUTE: 60_000 }));
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
import { POST } from "./route";

const token = "x".repeat(43);
const request = (body: unknown, origin = "https://mono.test") => new Request("https://mono.test/api/auth/email-verification", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue(null);
  mocks.user.mockResolvedValue({ id: "self", emailVerified: null });
});

it("confirms a mailbox capability without creating or requiring a login, returning only a private JSON result", async () => {
  const result = await POST(request({ action: "confirm", token }));
  expect(await result.json()).toMatchObject({ status: "success" });
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(result.headers.get("content-type")).toContain("application/json");
  expect(mocks.confirm).toHaveBeenCalledWith(token);
  expect(mocks.user).not.toHaveBeenCalled();
});

it.each(["", "null", "https://foreign.test"])("blocks an untrusted origin (%s) before consuming a token", async (origin) => {
  expect((await POST(request({ action: "confirm", token }, origin))).status).toBe(403);
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it("rejects malformed tokens, unexpected account IDs and excessive requests before mutation", async () => {
  expect((await POST(request({ action: "confirm", token: "bad" }))).status).toBe(422);
  expect((await POST(request({ action: "remember", token, userId: "other" }))).status).toBe(422);
  mocks.limit.mockResolvedValue("Wait before trying again.");
  expect((await POST(request({ action: "confirm", token }))).status).toBe(429);
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(mocks.remember).not.toHaveBeenCalled();
});

it("checks fresh verification only for the session user and binds invitation hints to that account", async () => {
  expect(await (await POST(request({ action: "check" }))).json()).toMatchObject({ status: "error" });
  mocks.user.mockResolvedValue({ id: "self", emailVerified: new Date() });
  expect(await (await POST(request({ action: "check" }))).json()).toMatchObject({ status: "success" });
  await POST(request({ action: "remember", token }));
  expect(mocks.remember).toHaveBeenCalledWith("self", token);
  mocks.user.mockRejectedValue(new AuthenticationError());
  expect((await POST(request({ action: "check" }))).status).toBe(401);
});

it("preserves expired/replayed capability errors", async () => {
  mocks.confirm.mockRejectedValue(new ValidationError("This link is already used."));
  const result = await POST(request({ action: "confirm", token }));
  expect(result.status).toBe(422);
  expect(await result.json()).toMatchObject({ status: "error", message: "This link is already used." });
});
