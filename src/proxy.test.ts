import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/session", () => ({ SESSION_COOKIE_NAME: "session", verifySession: async () => ({ userId: "user", tokenVersion: 0, sessionId: "revoked" }) }));
import { proxy } from "./proxy";

it("allows signed but revoked cookies to reach login for the authoritative database check", async () => {
  const response = await proxy(new NextRequest("https://mono.test/login", { headers: { cookie: "session=signed-but-revoked" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
});

it("routes unauthenticated admin visits to the dedicated sign-in without redirecting that form itself", async () => {
  const response = await proxy(new NextRequest("https://mono.test/admin"));
  expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  const login = await proxy(new NextRequest("https://mono.test/admin/login"));
  expect(login.headers.get("location")).toBeNull();
  expect(login.headers.get("x-middleware-next")).toBe("1");
});
