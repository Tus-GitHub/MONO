import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), remove: vi.fn(), clear: vi.fn(), deleteCookie: vi.fn(), getCookie: vi.fn(), register: vi.fn(), write: vi.fn(), after: vi.fn(), registrationEmails: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie, delete: mocks.deleteCookie }) }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/auth/session-cookie", () => ({ clearSessionCookie: mocks.clear, writeSessionCookie: mocks.write }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { pushSubscription: { deleteMany: mocks.remove } } }));
vi.mock("@/server/services/auth-service", () => ({ authenticate: vi.fn(), beginPasswordReset: vi.fn(), completePasswordReset: vi.fn(), registerUser: mocks.register }));
vi.mock("@/server/services/session-service", () => ({ revokeCurrentAuthSession: vi.fn() }));
vi.mock("@/server/services/email-verification-service", () => ({ sendRegistrationEmails: mocks.registrationEmails }));
vi.mock("@/lib/security/rate-limit", () => ({ MINUTE: 60_000, checkRateLimit: async () => null }));
import { logoutAction, registerAction } from "./auth";
import { idleState } from "@/lib/utils/result";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "current-user" });
  mocks.remove.mockResolvedValue({ count: 1 });
  mocks.clear.mockResolvedValue(undefined);
  mocks.getCookie.mockReturnValue({ value: "this-device" });
});

it("schedules registration mail after session creation, without delaying the onboarding redirect", async () => {
  mocks.register.mockResolvedValue({ id: "new-user", tokenVersion: 0 });
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Alex", email: "alex@example.test", password: "NewPassword123!", confirmPassword: "NewPassword123!" })) form.set(key, value);
  await expect(registerAction(idleState, form)).rejects.toThrow("redirect:/onboarding");
  expect(mocks.write.mock.invocationCallOrder[0]).toBeLessThan(mocks.after.mock.invocationCallOrder[0]);
  expect(mocks.registrationEmails).not.toHaveBeenCalled();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.registrationEmails).toHaveBeenCalledWith("new-user");
});

it("does not schedule mail when registration fails", async () => {
  mocks.register.mockRejectedValue(new Error("database unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Alex", email: "alex@example.test", password: "NewPassword123!", confirmPassword: "NewPassword123!" })) form.set(key, value);
  const result = await registerAction(idleState, form);
  expect(result.status).toBe("error");
  expect(mocks.after).not.toHaveBeenCalled();
  log.mockRestore();
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
