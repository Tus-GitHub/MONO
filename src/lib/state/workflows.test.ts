import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskScope } from "./task";
import { ConfirmationController } from "./confirmation";
import { overlayHistoryAction, overlayTransition } from "./overlay";
import { dirtyTransition } from "./dirty";
import { capabilityState, sessionState, coupleState } from "./access";
import { waitFor } from "./wait-for";
import { restoreStage, canRestoreArchive } from "@/lib/archive/restore-state";
import { cleanupStage, deliveryOutcome } from "@/lib/jobs/lifecycle";
import { reminderAllowed, reminderSchedulePatch, reminderStage } from "@/lib/notifications/reminder-state";
import { dateAllows } from "@/lib/date/permissions";
import { lifecyclePatch } from "@/lib/date/lifecycle";

const now = new Date("2026-11-13T12:00:00Z");
const future = new Date(now.getTime() + 60_000);
const past = new Date(now.getTime() - 60_000);
afterEach(() => vi.useRealTimers());

describe("async ownership", () => {
  it("rejects a second action before a React pending render", () => {
    const scope = new TaskScope();
    const signal = scope.begin()!;
    expect(scope.begin()).toBeNull();
    expect(scope.finish(signal)).toBe(true);
    expect(scope.begin()).not.toBeNull();
  });
  it("ignores completion and finalizers from a cancelled/replaced request", () => {
    const scope = new TaskScope();
    const old = scope.begin()!;
    const next = scope.begin(true)!;
    expect(old.aborted).toBe(true);
    expect(scope.finish(old)).toBe(false);
    expect(scope.owns(next)).toBe(true);
    scope.cancel();
    expect(next.aborted).toBe(true);
    expect(scope.finish(next)).toBe(false);
  });
  it("bounds an unavailable browser service and aborts pending waits", async () => {
    vi.useFakeTimers();
    const pending = new Promise<never>(() => {});
    const controller = new AbortController();
    const timeout = expect(waitFor(pending, controller.signal, 100)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100); await timeout;
    const aborted = expect(waitFor(pending, controller.signal)).rejects.toThrow("cancelled");
    controller.abort(); await aborted;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("confirmation and overlay transitions", () => {
  it("does not orphan an earlier confirmation on double click", async () => {
    const controller = new ConfirmationController<string>();
    const first = controller.request("delete");
    expect(await controller.request("another")).toBe(false);
    controller.settle(true);
    expect(controller.getSnapshot().stage).toBe("closing");
    expect(await controller.request("while closing")).toBe(false);
    controller.historyClosed(true);
    expect(await first).toBe(true);
    expect(controller.getSnapshot().stage).toBe("idle");
  });
  it("refuses acceptance if navigation won the race, and resolves on unmount", async () => {
    const controller = new ConfirmationController<string>();
    const first = controller.request("delete");
    controller.settle(true); controller.historyClosed(false);
    expect(await first).toBe(false);
    const second = controller.request("delete"); controller.dispose();
    expect(await second).toBe(false);
  });
  it("keeps cancellation pending until the history entry is gone", async () => {
    const controller = new ConfirmationController<string>();
    const result = controller.request("delete");
    controller.settle(false); controller.settle(true); controller.historyClosed(true);
    expect(await result).toBe(false);
  });
  it("ignores an old exit timer after reopening", () => {
    let phase = overlayTransition("open", "hide");
    phase = overlayTransition(phase, "show");
    expect(overlayTransition(phase, "exited")).toBe("entering");
    expect(overlayTransition(phase, "entered")).toBe("open");
  });
  it("waits for nested overlays and performs only one history traversal", () => {
    expect(overlayHistoryAction(["parent", "child"], "parent", true, false)).toBe("wait");
    expect(overlayHistoryAction(["parent"], "parent", true, false)).toBe("back");
    expect(overlayHistoryAction(["parent"], "parent", true, true)).toBe("wait");
    expect(overlayHistoryAction([], "parent", true, true)).toBe("complete");
    expect(overlayHistoryAction(["parent"], "parent", false, false)).toBe("complete");
  });
  it("does not mark edits made after submission as saved", () => {
    let state = { revision: 0, saved: 0, submitted: null as number | null };
    for (const event of ["edit", "submit", "edit", "success"] as const) state = dirtyTransition(state, event);
    expect(state.revision).toBe(2); expect(state.saved).toBe(1);
    expect(dirtyTransition(state, "reset").saved).toBe(2);
  });
});

describe("persisted capabilities", () => {
  it("expires tokens at the exact boundary and never revives consumed tokens", () => {
    expect(capabilityState({ expiresAt: now }, now)).toBe("expired");
    expect(capabilityState({ expiresAt: future }, now)).toBe("available");
    expect(capabilityState({ expiresAt: future, usedAt: past }, now)).toBe("consumed");
    expect(capabilityState({ expiresAt: future, revokedAt: past }, now)).toBe("revoked");
  });
  it("rejects a valid-looking session after account invalidation", () => {
    const session = { expiresAt: future, revokedAt: null, tokenVersion: 1, user: { tokenVersion: 1, deletedAt: null as Date | null } };
    expect(sessionState(session, now)).toBe("active");
    expect(sessionState({ ...session, user: { tokenVersion: 2 } }, now)).toBe("invalidated");
    expect(sessionState({ ...session, user: { tokenVersion: 1, deletedAt: past } }, now)).toBe("invalidated");
    expect(sessionState({ ...session, expiresAt: now }, now)).toBe("expired");
    expect(sessionState({ ...session, revokedAt: past }, now)).toBe("revoked");
    expect(coupleState({ status: "ACTIVE", deletedAt: past })).toBe("deleted");
  });
  it("invalidates approval when the file changes or the deadline is reached", () => {
    const input = { selectedDigest: "a", approval: { code: "code", digest: "a", expiresAt: future.getTime() }, blocked: false, restored: false };
    expect(restoreStage(input, now.getTime())).toBe("approved");
    expect(restoreStage({ ...input, selectedDigest: "b" }, now.getTime())).toBe("preview");
    expect(restoreStage(input, future.getTime())).toBe("expired");
    expect(restoreStage({ ...input, blocked: true }, now.getTime())).toBe("blocked");
    const ready = { stage: "approved" as const, isExporter: true, hasPartner: true, partnerCode: "partner", consented: true };
    expect(canRestoreArchive(ready)).toBe(true);
    expect(canRestoreArchive({ ...ready, partnerCode: " " })).toBe(false);
    expect(canRestoreArchive({ ...ready, isExporter: false })).toBe(false);
    expect(canRestoreArchive({ ...ready, consented: false })).toBe(false);
  });
});

describe("date and background transitions", () => {
  it("permits same-day finalization, preserving first start and clearing current completion on reopen", () => {
    expect(lifecyclePatch({ status: "DRAFT", plannedAt: null, startedAt: null }, "TODAY", now)).toMatchObject({ plannedAt: now, cancelledAt: null });
    expect(lifecyclePatch({ status: "COMPLETED", plannedAt: past, startedAt: past }, "IN_PROGRESS", now)).toMatchObject({ startedAt: past, completedAt: null });
    expect(lifecyclePatch({ status: "PLANNED", plannedAt: past, startedAt: null }, "PLANNED", now)).toEqual({});
    expect(() => lifecyclePatch({ status: "DRAFT", plannedAt: null, startedAt: null }, "COMPLETED", now)).toThrow();
  });
  it("has consistent feature permissions for cancelled and pre-execution dates", () => {
    for (const capability of ["plan", "actuals", "photo", "review", "memory", "revisit"] as const) expect(dateAllows("CANCELLED", capability)).toBe(false);
    expect(dateAllows("TODAY", "actuals")).toBe(true);
    expect(dateAllows("TODAY", "review")).toBe(false);
    expect(dateAllows("COMPLETED", "plan")).toBe(false);
    expect(dateAllows("COMPLETED", "memory")).toBe(true);
  });
  it("recognizes cleanup exhaustion even if there is no lease left", () => {
    const job = { failedAt: null, attempts: 6, leaseUntil: null, nextAttemptAt: past };
    expect(cleanupStage(job, now)).toBe("failed");
    expect(cleanupStage({ ...job, leaseUntil: future }, now)).toBe("processing");
    expect(cleanupStage({ ...job, attempts: 0, nextAttemptAt: future }, now)).toBe("scheduled");
    expect(cleanupStage({ ...job, attempts: 0 }, now)).toBe("ready");
    expect(deliveryOutcome(5)).toBe("PENDING"); expect(deliveryOutcome(6)).toBe("FAILED");
  });
  it("keeps routine reminder edits retired but explicitly rearms moved occurrences", () => {
    const reminder = { scheduledFor: now, sentAt: past, dismissedAt: past };
    expect(reminderSchedulePatch(reminder, future).sentAt).toBe(past);
    expect(reminderSchedulePatch(reminder, new Date(now.getTime() + 3_600_001))).toMatchObject({ sentAt: null, dismissedAt: null });
    expect(reminderStage({ scheduledFor: now }, now)).toBe("due");
    expect(reminderStage({ scheduledFor: future }, now)).toBe("scheduled");
    expect(reminderStage({ scheduledFor: new Date(now.getTime() - 3 * 86_400_000) }, now)).toBe("expired");
    expect(reminderAllowed("REVIEW", "IN_PROGRESS")).toBe(false);
    expect(reminderAllowed("REVIEW", "COMPLETED")).toBe(true);
    expect(reminderAllowed("CUSTOM", "CANCELLED")).toBe(false);
  });
});
