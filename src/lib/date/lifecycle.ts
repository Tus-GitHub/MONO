import { DateStatus } from "@prisma/client";

import { InvalidTransitionError } from "@/lib/errors";

/**
 * The Date lifecycle.
 *
 *   DRAFT ─▶ PLANNED ─▶ TODAY ─▶ IN_PROGRESS ─▶ COMPLETED
 *     │        │          │           │
 *     └────────┴──────────┴───────────┴────────▶ CANCELLED
 *
 * `TODAY` is a scheduling convenience (the plan's day has arrived); it is otherwise
 * equivalent to `PLANNED`. `COMPLETED` may be reopened to `IN_PROGRESS` to correct actuals.
 * These are pure rules — no database, no request context — so they can be unit tested and
 * reused by services, jobs, and UI badges alike.
 */
export const DATE_STATUS_TRANSITIONS: Record<DateStatus, readonly DateStatus[]> = {
  [DateStatus.DRAFT]: [DateStatus.PLANNED, DateStatus.CANCELLED],
  [DateStatus.PLANNED]: [
    DateStatus.TODAY,
    DateStatus.IN_PROGRESS,
    DateStatus.DRAFT,
    DateStatus.CANCELLED,
  ],
  [DateStatus.TODAY]: [
    DateStatus.IN_PROGRESS,
    DateStatus.COMPLETED,
    DateStatus.PLANNED,
    DateStatus.CANCELLED,
  ],
  [DateStatus.IN_PROGRESS]: [DateStatus.COMPLETED, DateStatus.CANCELLED],
  [DateStatus.COMPLETED]: [DateStatus.IN_PROGRESS],
  [DateStatus.CANCELLED]: [DateStatus.DRAFT, DateStatus.PLANNED],
};

/** Statuses that represent a date that has happened and can carry completion data. */
export const COMPLETION_STATUSES: readonly DateStatus[] = [
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

/** Statuses that still represent a plan rather than a lived experience. */
export const PLANNING_STATUSES: readonly DateStatus[] = [
  DateStatus.DRAFT,
  DateStatus.PLANNED,
  DateStatus.TODAY,
];

export function canTransition(from: DateStatus, to: DateStatus): boolean {
  if (from === to) return true;
  return DATE_STATUS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DateStatus, to: DateStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(
      `A date cannot move from ${from} to ${to}.`,
    );
  }
}

export function isCompletionStatus(status: DateStatus): boolean {
  return COMPLETION_STATUSES.includes(status);
}

export function isPlanningStatus(status: DateStatus): boolean {
  return PLANNING_STATUSES.includes(status);
}

type LifecycleTimestamps = Partial<
  Record<"plannedAt" | "startedAt" | "completedAt" | "cancelledAt", Date>
>;

/** Timestamp columns to stamp when entering a given status. */
export function lifecycleTimestampsFor(to: DateStatus, now = new Date()): LifecycleTimestamps {
  switch (to) {
    case DateStatus.PLANNED:
      return { plannedAt: now };
    case DateStatus.IN_PROGRESS:
      return { startedAt: now };
    case DateStatus.COMPLETED:
      return { completedAt: now };
    case DateStatus.CANCELLED:
      return { cancelledAt: now };
    default:
      return {};
  }
}
