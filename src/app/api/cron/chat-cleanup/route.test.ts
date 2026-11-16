import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ env: { CRON_SECRET: "s".repeat(32) }, cleanup: vi.fn() }));
vi.mock("@/config/env", () => ({ env: mocks.env }));
vi.mock("@/server/services/storage-cleanup-service", () => ({ processStorageCleanup: mocks.cleanup }));
import { GET } from "./route";
const request = (secret = "s".repeat(32)) => new Request("https://amor.test/api/cron/chat-cleanup", { headers: { Authorization: `Bearer ${secret}` } });
beforeEach(() => {
  vi.clearAllMocks(); mocks.env.CRON_SECRET = "s".repeat(32);
  mocks.cleanup.mockResolvedValue({ processed: 0, removed: 0, kept: 0, failed: 0 });
});
it("rejects missing or incorrect worker credentials before any storage access", async () => {
  for (const value of ["", "wrong", "t".repeat(32)]) expect((await GET(request(value))).status).toBe(401);
  mocks.env.CRON_SECRET = "";
  expect((await GET(request())).status).toBe(401);
  expect(mocks.cleanup).not.toHaveBeenCalled();
});
it("drains only queued chat video jobs and never caches its result", async () => {
  mocks.cleanup.mockResolvedValueOnce({ processed: 50, removed: 49, kept: 1, failed: 0 });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ processed: 50, removed: 49, kept: 1, failed: 0 });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  expect(mocks.cleanup).toHaveBeenCalledWith({ chatVideosOnly: true, limit: 50 });
});
it("reports storage failures for operator visibility", async () => {
  mocks.cleanup.mockResolvedValue({ processed: 1, removed: 0, kept: 0, failed: 1 });
  expect((await GET(request())).status).toBe(503);
});
it("keeps a bounded worker invocation even with a large backlog", async () => {
  mocks.cleanup.mockResolvedValue({ processed: 50, removed: 50, kept: 0, failed: 0 });
  expect((await GET(request())).status).toBe(200);
  expect(mocks.cleanup).toHaveBeenCalledTimes(20);
});
