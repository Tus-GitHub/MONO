import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { DeliverablePayload } from "@/lib/notifications/channels";

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
vi.mock("@/server/services/notification-delivery-service", () => ({
  enqueueNotification: (tx: Prisma.TransactionClient, userId: string, payload: DeliverablePayload) =>
    tx.notification.create({ data: { ...payload, userId } }),
  processNotificationDeliveries: mocks.push,
}));
import { dispatchDueReminders, dispatchDueRemindersDetailed, getDueReminders } from "./reminder-service";

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
  expect(mocks.push).toHaveBeenCalledWith({ userId: "user" });
});

it("persists in-app delivery inside the claim transaction before external delivery", async () => {
  expect(await dispatchDueReminders("user")).toBe(1);
  expect(mocks.tx.notification.create).toHaveBeenCalledOnce();
  expect(mocks.push).toHaveBeenCalledOnce();
  expect(mocks.tx.notification.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.push.mock.invocationCallOrder[0]);
});

it("reports a failed persistence attempt while still flushing earlier queued work", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.tx.notification.create.mockRejectedValue(new Error("database unavailable"));
  expect(await dispatchDueRemindersDetailed("user")).toEqual({ delivered: 0, failed: 1 });
  log.mockRestore();
});

it("delivers a scheduled occurrence even when the date has a recent notification", async () => {
  mocks.tx.notification.findFirst.mockResolvedValue({ id: "prior" });
  expect(await dispatchDueReminders("user")).toBe(1);
  expect(mocks.push).toHaveBeenCalledOnce();
});

it("delivers day-of and custom reminders independently for the same date", async () => {
  const date = { id: "date", title: "Dinner", status: "PLANNED", scheduledFor: null, plannedStartAt: null };
  mocks.prisma.dateReminder.findMany.mockResolvedValue([
    { id: "day", kind: "DATE_DAY", scheduledFor: new Date(), date },
    { id: "custom", kind: "CUSTOM", scheduledFor: new Date(), date },
  ]);
  expect(await dispatchDueReminders("user")).toBe(2);
  expect(mocks.tx.notification.create).toHaveBeenCalledTimes(2);
  expect(mocks.push).toHaveBeenCalledOnce();
});

it("only retires the expired occurrence that was read, protecting concurrent rescheduling", async () => {
  const scheduledFor = new Date(Date.now() - 3 * 86_400_000);
  mocks.prisma.dateReminder.findMany.mockResolvedValue([{
    id: "expired", kind: "CUSTOM", scheduledFor,
    date: { id: "date", status: "PLANNED" },
  }]);
  expect(await getDueReminders("user")).toEqual([]);
  expect(mocks.prisma.dateReminder.updateMany).toHaveBeenCalledWith({
    where: { sentAt: null, dismissedAt: null, OR: [{ id: "expired", scheduledFor }] },
    data: { dismissedAt: expect.any(Date) },
  });
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
