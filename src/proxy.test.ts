import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/session", () => ({ SESSION_COOKIE_NAME: "session", verifySession: async () => ({ userId: "user", tokenVersion: 0, sessionId: "revoked" }) }));
import { proxy } from "./proxy";

it("allows signed but revoked cookies to reach login for the authoritative database check", async () => {
  const response = await proxy(new NextRequest("https://mono.test/login", { headers: { cookie: "session=signed-but-revoked" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
});
