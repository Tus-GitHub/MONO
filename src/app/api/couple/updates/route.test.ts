import { beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";
const mocks = vi.hoisted(() => ({ context: vi.fn(), revision: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireCoupleContext: mocks.context }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("@/server/services/couple-sync-service", () => ({ coupleRevision: mocks.revision }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks(); mocks.context.mockResolvedValue({ user: { id: "viewer" }, couple: { id: "own", updatedAt: new Date(0) } });
  mocks.revision.mockResolvedValue("opaque-revision"); mocks.limit.mockReturnValue({ ok: true });
});
it("returns only a private revision for the authenticated couple", async () => {
  const response = await GET();
  expect(await response.json()).toEqual({ revision: "opaque-revision" });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.revision).toHaveBeenCalledWith("own", new Date(0));
});
it("denies anonymous requests before querying date metadata", async () => {
  mocks.context.mockRejectedValue(new AuthenticationError());
  expect((await GET()).status).toBe(401); expect(mocks.revision).not.toHaveBeenCalled();
});
it("bounds polling per authenticated user and tells clients when to retry", async () => {
  mocks.limit.mockReturnValue({ ok: false, retryAfterSec: 10 });
  const response = await GET(); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("10");
  expect(mocks.revision).not.toHaveBeenCalled();
});
