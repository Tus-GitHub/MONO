import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), remove: vi.fn(), clear: vi.fn(), deleteCookie: vi.fn(), getCookie: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie, delete: mocks.deleteCookie }) }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/auth/session-cookie", () => ({ clearSessionCookie: mocks.clear, writeSessionCookie: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { pushSubscription: { deleteMany: mocks.remove } } }));
vi.mock("@/server/services/auth-service", () => ({ authenticate: vi.fn(), beginPasswordReset: vi.fn(), completePasswordReset: vi.fn(), registerUser: vi.fn() }));
vi.mock("@/server/services/session-service", () => ({ revokeCurrentAuthSession: vi.fn() }));
import { logoutAction } from "./auth";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "current-user" });
  mocks.remove.mockResolvedValue({ count: 1 });
  mocks.clear.mockResolvedValue(undefined);
  mocks.getCookie.mockReturnValue({ value: "this-device" });
});

it("unlinks a migrated legacy browser without removing newly registered devices", async () => {
  mocks.getCookie.mockReturnValue(undefined);
  await expect(logoutAction()).rejects.toThrow("redirect:/login");
  expect(mocks.remove).toHaveBeenCalledWith({ where: { userId: "current-user", id: { startsWith: "legacy_" } } });
});

it("unlinks only this authenticated browser before clearing the session", async () => {
  await expect(logoutAction()).rejects.toThrow("redirect:/login");
  expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "this-device", userId: "current-user" } });
  expect(mocks.deleteCookie).toHaveBeenCalledWith("mono_push_device");
  expect(mocks.clear).toHaveBeenCalledOnce();
});

it("still clears authentication when the database is unavailable", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.user.mockRejectedValue(new Error("database unavailable"));
  await expect(logoutAction()).rejects.toThrow("redirect:/login");
  expect(mocks.clear).toHaveBeenCalledOnce();
  expect(mocks.remove).not.toHaveBeenCalled();
  log.mockRestore();
});
