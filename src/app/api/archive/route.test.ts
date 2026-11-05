import { beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ session: vi.fn(), export: vi.fn(), approve: vi.fn(), restore: vi.fn(), limit: vi.fn() }));
vi.mock("@/server/services/session-service", () => ({ requireAuthSession: mocks.session }));
vi.mock("@/server/services/archive-service", () => ({ exportCoupleArchive: mocks.export, approveArchiveRestore: mocks.approve, restoreCoupleArchive: mocks.restore }));
vi.mock("@/lib/security/rate-limit", () => ({ MINUTE: 60_000, rateLimit: mocks.limit }));
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
import { GET, POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ userId: "current", sessionId: "device", tokenVersion: 1 });
  mocks.limit.mockReturnValue({ ok: true, retryAfterSec: 0 });
});
const request = (value: unknown, headers: Record<string, string> = {}) => new Request("https://mono.test/api/archive", { method: "POST", headers: { Origin: "https://mono.test", "Content-Type": "application/json", ...headers }, body: JSON.stringify(value) });

it("downloads a no-store attachment only after authentication", async () => {
  mocks.export.mockResolvedValue({ format: "mono.archive.v1", digest: "fixture" });
  const result = await GET();
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(result.headers.get("content-disposition")).toMatch(/^attachment; filename="mono-archive-/);
  expect(await result.json()).toMatchObject({ digest: "fixture" });
  mocks.session.mockRejectedValueOnce(new AuthenticationError());
  expect((await GET()).status).toBe(401);
  expect(mocks.export).toHaveBeenCalledTimes(1);
});

it.each(["https://foreign.test", "null", ""]) ("refuses foreign or missing origins: %s", async (origin) => {
  expect((await POST(request({ action: "approve", archive: {} }, { Origin: origin }))).status).toBe(403);
  expect(mocks.approve).not.toHaveBeenCalled();
});

it("limits expensive authenticated requests by user and stops before reading/restoring content", async () => {
  mocks.limit.mockReturnValue({ ok: false, retryAfterSec: 60 });
  expect((await GET()).status).toBe(429);
  expect((await POST(request({ action: "restore", archive: {}, approvals: ["approval"] }))).status).toBe(429);
  expect(mocks.export).not.toHaveBeenCalled();
  expect(mocks.restore).not.toHaveBeenCalled();
  expect(mocks.limit).toHaveBeenCalledWith("archive:current", 8, 600_000);
});

it("requires JSON, bounds declared bytes, and rejects unexpected restore fields", async () => {
  expect((await POST(request({}, { "Content-Type": "text/plain" }))).status).toBe(415);
  expect((await POST(request({}, { "Content-Length": String(70 * 1024 * 1024) }))).status).toBe(413);
  expect((await POST(request({ action: "restore", archive: {}, approvals: ["approval"], coupleId: "foreign" }))).status).toBe(422);
  expect(mocks.restore).not.toHaveBeenCalled();
});

it("passes only the validated archive and consent tokens to the service", async () => {
  mocks.approve.mockResolvedValue({ approval: "signed", digest: "manifest" });
  expect((await POST(request({ action: "approve", archive: { fixture: true } }))).status).toBe(200);
  expect(mocks.approve).toHaveBeenCalledWith({ fixture: true });
  mocks.restore.mockResolvedValue({ restored: true });
  const result = await POST(request({ action: "restore", archive: { fixture: true }, approvals: ["first", "second"] }));
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(mocks.restore).toHaveBeenCalledWith({ fixture: true }, ["first", "second"]);
});

it("returns a generic failure without exposing storage/provider details", async () => {
  mocks.export.mockRejectedValue(new Error("private storage endpoint credential"));
  const result = await GET();
  expect(result.status).toBe(500);
  expect(JSON.stringify(await result.json())).not.toContain("credential");
});
