import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ begin: vi.fn(), complete: vi.fn(), limit: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/security/rate-limit", () => ({ MINUTE: 60_000, checkRateLimit: mocks.limit }));
vi.mock("@/server/services/email-verification-service", () => ({ beginEmailVerification: mocks.begin, completeEmailVerification: mocks.complete }));
import { requestVerificationAction, verifyEmailAction } from "./email-verification";
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
it("rejects malformed email/token fields before invoking business logic", async () => {
  expect((await requestVerificationAction(idleState, form("email", "bad"))).status).toBe("error");
  expect((await verifyEmailAction(idleState, form("token", "bad"))).status).toBe("error");
  expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
});
it("honors request limits before creating mail or consuming a token", async () => {
  mocks.limit.mockResolvedValue("Try again later.");
  expect((await requestVerificationAction(idleState, form("email", "person@example.test"))).status).toBe("error");
  expect((await verifyEmailAction(idleState, form("token", "a".repeat(43)))).status).toBe("error");
  expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
});
it("refreshes verified status after a successful explicit confirmation", async () => {
  const value = "a".repeat(43);
  expect((await verifyEmailAction(idleState, form("token", value))).status).toBe("success");
  expect(mocks.complete).toHaveBeenCalledWith(value);
  expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
});
