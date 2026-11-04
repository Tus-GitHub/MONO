import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { dateReminder: { findMany: mocks.findMany } } }));
vi.mock("@/server/services/reminder-service", () => ({ dispatchDueReminders: mocks.dispatch }));
import { dispatchScheduledReminders } from "./reminder-scheduler-service";

it("continues to other recipients after one user fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findMany.mockResolvedValue([{ userId: "a" }, { userId: "b" }]);
  mocks.dispatch.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce(2);
  expect(await dispatchScheduledReminders()).toEqual({ users: 2, delivered: 2, failedUsers: 1 });
  expect(mocks.dispatch).toHaveBeenCalledWith("b");
  log.mockRestore();
});
