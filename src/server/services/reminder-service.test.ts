import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    dateReminder: { findMany: vi.fn(), updateMany: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    dateReminder: { updateMany: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
  },
  push: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notifications/channels", () => ({
  getNotificationChannels: () => [{ name: "push", deliver: mocks.push }],
}));
import { dispatchDueReminders, getDueReminders } from "./reminder-service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.dateReminder.findMany.mockResolvedValue([{
    id: "reminder", kind: "CUSTOM", scheduledFor: new Date(),
    date: { id: "date", title: "Dinner", status: "PLANNED", scheduledFor: null, plannedStartAt: null },
  }]);
  mocks.prisma.notificationPreference.findUnique.mockResolvedValue(null);
  mocks.prisma.dateReminder.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.dateReminder.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.notification.findFirst.mockResolvedValue(null);
  mocks.tx.notification.create.mockResolvedValue({ id: "notification" });
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.push.mockResolvedValue({ ok: true });
});

it("does not notify when another dispatcher already claimed the reminder", async () => {
  mocks.tx.dateReminder.updateMany.mockResolvedValue({ count: 0 });
  expect(await dispatchDueReminders("user")).toBe(0);
  expect(mocks.tx.notification.create).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

it("persists in-app delivery inside the claim transaction before external delivery", async () => {
  expect(await dispatchDueReminders("user")).toBe(1);
  expect(mocks.tx.notification.create).toHaveBeenCalledOnce();
  expect(mocks.push).toHaveBeenCalledOnce();
  expect(mocks.tx.notification.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.push.mock.invocationCallOrder[0]);
});

it("does not push if the transaction fails to persist the notification", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.tx.notification.create.mockRejectedValue(new Error("database unavailable"));
  expect(await dispatchDueReminders("user")).toBe(0);
  expect(mocks.push).not.toHaveBeenCalled();
  log.mockRestore();
});

it("retires a reminder without sending again when a recent notification exists", async () => {
  mocks.tx.notification.findFirst.mockResolvedValue({ id: "prior" });
  expect(await dispatchDueReminders("user")).toBe(0);
  expect(mocks.tx.notification.create).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

it("scopes eligibility to a living user and their active couple membership", async () => {
  await getDueReminders("user");
  expect(mocks.prisma.dateReminder.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      user: { deletedAt: null },
      date: expect.objectContaining({ couple: expect.objectContaining({
        members: { some: { userId: "user", status: "ACTIVE" } },
      }) }),
    }),
  }));
});
