import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: { CRON_SECRET: "s".repeat(32) }, dispatch: vi.fn() }));
vi.mock("@/config/env", () => ({ env: mocks.env }));
vi.mock("@/server/services/reminder-scheduler-service", () => ({
  dispatchScheduledReminders: mocks.dispatch,
}));
import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.CRON_SECRET = "s".repeat(32);
});

it.each([undefined, "Bearer wrong", `Bearer ${"x".repeat(32)}`])("rejects invalid authentication (%s)", async (token) => {
  const response = await GET(new Request("https://mono.test/api/cron/reminders", {
    headers: token ? { Authorization: token } : {},
  }));
  expect(response.status).toBe(401);
  expect(mocks.dispatch).not.toHaveBeenCalled();
});

it("fails closed when unconfigured", async () => {
  mocks.env.CRON_SECRET = "";
  expect((await GET(new Request("https://mono.test/api/cron/reminders"))).status).toBe(503);
  expect(mocks.dispatch).not.toHaveBeenCalled();
});

it.each([0, 1])("returns aggregate counts without caching (failed users: %s)", async (failedUsers) => {
  const result = { users: 2, delivered: 1, failedUsers };
  mocks.dispatch.mockResolvedValue(result);
  const response = await GET(new Request("https://mono.test/api/cron/reminders?userId=foreign", {
    headers: { Authorization: `Bearer ${mocks.env.CRON_SECRET}` },
  }));
  expect(response.status).toBe(failedUsers ? 503 : 200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(result);
  expect(mocks.dispatch).toHaveBeenCalledWith();
});
