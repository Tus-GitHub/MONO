import { beforeEach, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/config/env", () => ({ isProduction: true }));
import { rememberInvitation, pendingInvitationPath } from "./pending-invitation";

beforeEach(() => vi.resetAllMocks());
it("saves only a valid account-bound hint in a secure HTTP-only cookie", async () => {
  await rememberInvitation("user-a", "safe_invitation_token");
  expect(store.set).toHaveBeenCalledWith("mono_pending_invitation", JSON.stringify({ userId: "user-a", token: "safe_invitation_token" }), expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 259200 }));
  await rememberInvitation("user-a", "https://attacker.test");
  expect(store.set).toHaveBeenCalledTimes(1);
});
it("returns only a same-origin invite path for the matching account", async () => {
  store.get.mockReturnValue({ value: JSON.stringify({ userId: "user-a", token: "safe_invitation_token" }) });
  expect(await pendingInvitationPath("user-a")).toBe("/invite/safe_invitation_token");
  expect(await pendingInvitationPath("user-b")).toBeNull();
});
it.each(["corrupt", "null", JSON.stringify({ userId: "user-a", token: "//attacker.test" })])("ignores corrupt or unsafe hints (%s)", async (value) => {
  store.get.mockReturnValue({ value });
  expect(await pendingInvitationPath("user-a")).toBeNull();
});
