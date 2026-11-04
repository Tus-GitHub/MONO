import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cookie: { get: vi.fn(), delete: vi.fn() }, user: vi.fn(), session: vi.fn(), fetch: vi.fn(),
  provider: { configured: true, clientId: "client", clientSecret: "secret", tokenEndpoint: "https://provider.test/token", userInfoEndpoint: "https://provider.test/user" },
}));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookie }));
vi.mock("@/lib/auth/session-cookie", () => ({ writeSessionCookie: mocks.session }));
vi.mock("@/lib/auth/oauth/google", () => ({
  googleProvider: mocks.provider, googleRedirectUri: () => "https://mono.test/api/auth/google/callback",
  upsertUserFromOAuthProfile: mocks.user,
}));
import { GET } from "./route";

const request = () => new NextRequest("https://mono.test/api/auth/google/callback?code=code&state=state");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.provider.configured = true;
  mocks.cookie.get.mockReturnValue({ value: "state" });
  mocks.user.mockResolvedValue({ id: "user", tokenVersion: 2 });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it("rejects state mismatches before exchanging the code", async () => {
  mocks.cookie.get.mockReturnValue({ value: "different" });
  expect((await GET(request())).headers.get("location")).toContain("error=oauth_state");
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.cookie.delete).toHaveBeenCalledWith("mono_oauth_state");
});

it.each([undefined, false])("requires an explicitly verified email (%s)", async (verified) => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ access_token: "token" }))
    .mockResolvedValueOnce(Response.json({ sub: "subject", email: "user@example.test", email_verified: verified }));
  expect((await GET(request())).headers.get("location")).toContain("error=oauth_email");
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.session).not.toHaveBeenCalled();
});

it("returns to login on provider outages", async () => {
  mocks.fetch.mockRejectedValue(new Error("network failed"));
  expect((await GET(request())).headers.get("location")).toContain("error=oauth_token");
  expect(mocks.session).not.toHaveBeenCalled();
});

it("rejects malformed token payloads", async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ access_token: null }));
  expect((await GET(request())).headers.get("location")).toContain("error=oauth_token");
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("writes a session only after a valid profile resolves", async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ access_token: "token", expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json({ sub: "subject", email: "user@example.test", email_verified: true }));
  expect((await GET(request())).headers.get("location")).toBe("https://mono.test/onboarding");
  expect(mocks.session).toHaveBeenCalledWith({ userId: "user", tokenVersion: 2 });
});

it("preserves the partner invitation through Google sign-in", async () => {
  const invite = "partner-invite-token";
  mocks.cookie.get.mockImplementation((key) => ({ value: key === "mono_oauth_state" ? "state" : invite }));
  mocks.fetch.mockResolvedValueOnce(Response.json({ access_token: "token" }))
    .mockResolvedValueOnce(Response.json({ sub: "subject", email: "user@example.test", email_verified: true }));
  expect((await GET(request())).headers.get("location")).toBe(`https://mono.test/invite/${invite}`);
});
