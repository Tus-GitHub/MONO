import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), dispatch: vi.fn(), process: vi.fn(), cleanup: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { dateReminder: { findMany: mocks.findMany } } }));
vi.mock("@/server/services/reminder-service", () => ({ dispatchDueRemindersDetailed: mocks.dispatch }));
vi.mock("@/server/services/notification-delivery-service", () => ({ processNotificationDeliveries: mocks.process }));
vi.mock("@/server/services/storage-cleanup-service", () => ({ processStorageCleanup: mocks.cleanup }));
import { dispatchScheduledReminders } from "./reminder-scheduler-service";

it("continues to other recipients after one user fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findMany.mockResolvedValue([{ userId: "a" }, { userId: "b" }]);
  mocks.process.mockResolvedValue({ failed: 0 });
  mocks.cleanup.mockResolvedValue({ failed: 0 });
  mocks.dispatch.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce({ delivered: 2, failed: 0 });
  expect(await dispatchScheduledReminders()).toEqual({ users: 2, delivered: 2, failedUsers: 1, delivery: { failed: 0 }, cleanup: { failed: 0 } });
  expect(mocks.dispatch).toHaveBeenCalledWith("b");
  log.mockRestore();
});

it("processes retries and cleanup even when no new reminders are due", async () => {
  mocks.findMany.mockResolvedValue([]);
  mocks.process.mockResolvedValue({ delivered: 1, failed: 0 });
  mocks.cleanup.mockResolvedValue({ removed: 1, failed: 0 });
  expect(await dispatchScheduledReminders()).toMatchObject({ users: 0, delivery: { delivered: 1 }, cleanup: { removed: 1 } });
});
