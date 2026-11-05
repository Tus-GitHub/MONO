import { expect, it, vi } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/config/env", () => ({ env: { AUTH_SECRET: "session-test-secret-at-least-thirty-two-bytes", SESSION_COOKIE_NAME: "session", SESSION_MAX_AGE_DAYS: 30 }, isProduction: false }));
import { signSession, verifySession, sessionCookieOptions } from "./session";

it("round-trips a signed device session and retains remember-me cookie semantics", async () => {
  const payload = { userId: "user", tokenVersion: 1, sessionId: "session_id" };
  expect(await verifySession(await signSession(payload))).toEqual(payload);
  expect(sessionCookieOptions().maxAge).toBeUndefined();
  expect(sessionCookieOptions(100).maxAge).toBe(100);
  expect(sessionCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
});

it.each([{ tv: 1 }, { tv: -1, sid: "device" }, { tv: 0.5, sid: "device" }, { tv: "1", sid: "device" }, { tv: 1, sid: "../../etc" }])("rejects legacy or malformed identity claims %j", async (claims) => {
  const token = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject("user").setIssuer("mono").setAudience("mono:web").setExpirationTime("1h").sign(new TextEncoder().encode("session-test-secret-at-least-thirty-two-bytes"));
  expect(await verifySession(token)).toBeNull();
});

it("rejects a differently signed or expired token", async () => {
  expect(await verifySession("invalid")).toBeNull();
  const token = await new SignJWT({ tv: 1, sid: "device" }).setProtectedHeader({ alg: "HS256" }).setSubject("user").setIssuer("mono").setAudience("mono:web").setExpirationTime("0s").sign(new TextEncoder().encode("different-session-test-secret-32-bytes"));
  expect(await verifySession(token)).toBeNull();
});
