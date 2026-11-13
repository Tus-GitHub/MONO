import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ begin: vi.fn(), limit: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/security/rate-limit", () => ({ MINUTE: 60_000, checkRateLimit: mocks.limit }));
vi.mock("@/server/services/email-verification-service", () => ({ beginEmailVerification: mocks.begin }));
import { requestVerificationAction, resendOwnVerificationAction } from "./email-verification";
import { idleState } from "@/lib/utils/result";

beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue(null); });
const form = (key: string, value: string) => { const data = new FormData(); data.set(key, value); return data; };

it("preserves the same resend response for missing accounts and provider failures without logging secrets", async () => {
  const input = form("email", "person@example.test");
  const missing = await requestVerificationAction(idleState, input);
  mocks.begin.mockRejectedValue(new Error("provider-secret-details"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await requestVerificationAction(idleState, input)).toEqual(missing);
  expect(JSON.stringify(log.mock.calls)).not.toContain("provider-secret-details");
  log.mockRestore();
});
it("rejects malformed email fields before invoking business logic", async () => {
  expect((await requestVerificationAction(idleState, form("email", "bad"))).status).toBe("error");
  expect(mocks.begin).not.toHaveBeenCalled();
});
it("honors request limits before creating mail", async () => {
  mocks.limit.mockResolvedValue("Try again later.");
  expect((await requestVerificationAction(idleState, form("email", "person@example.test"))).status).toBe("error");
  expect(mocks.begin).not.toHaveBeenCalled();
});

it("resends to the current account without accepting an arbitrary recipient", async () => {
  mocks.user.mockResolvedValue({ email: "owner@example.test" });
  await resendOwnVerificationAction(idleState);
  expect(mocks.begin).toHaveBeenCalledWith("owner@example.test");
});
