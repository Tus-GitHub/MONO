import { DateStatus, ReminderKind } from "@prisma/client";

export type ReminderStage = "scheduled" | "due" | "sent" | "dismissed" | "expired";
export const REMINDER_STALE_MS = 2 * 86_400_000;
export function reminderStage(row: { scheduledFor: Date; sentAt?: Date | null; dismissedAt?: Date | null }, now = new Date()): ReminderStage {
  if (row.dismissedAt) return "dismissed";
  if (row.sentAt) return "sent";
  if (row.scheduledFor.getTime() < now.getTime() - REMINDER_STALE_MS) return "expired";
  return row.scheduledFor > now ? "scheduled" : "due";
}

export function reminderAllowed(kind: ReminderKind, status: DateStatus): boolean {
  if (kind === ReminderKind.REVIEW || kind === ReminderKind.MEMORY) return status === DateStatus.COMPLETED;
  if (kind === ReminderKind.UNFINISHED_PLAN) return status === DateStatus.DRAFT;
  return status === DateStatus.PLANNED || status === DateStatus.TODAY || status === DateStatus.IN_PROGRESS;
}

/** Explicit rescheduling is a new occurrence; routine edits preserve sent/dismissed markers. */
export function reminderSchedulePatch(previous: { scheduledFor: Date; sentAt: Date | null; dismissedAt: Date | null }, scheduledFor: Date) {
  const moved = Math.abs(previous.scheduledFor.getTime() - scheduledFor.getTime()) > 3_600_000;
  return { scheduledFor, sentAt: moved ? null : previous.sentAt, dismissedAt: moved ? null : previous.dismissedAt };
}
