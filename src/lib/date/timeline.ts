const DEFAULT_ACTIVITY_MINUTES = 60;

export interface TimelineInput {
  id: string;
  title: string;
  durationMinutes: number | null;
  costCents: number | null;
}

export interface TimelineSlot extends TimelineInput {
  startAt: string | null; // ISO — null when the date has no start time
  endAt: string | null;
  minutes: number;
}

/**
 * Lays activities on a clock: each starts where the previous ended, beginning at the date's
 * planned start time. With no start time, slots have no clock times (order still shown).
 */
export function buildTimeline(
  startAtIso: string | null,
  activities: TimelineInput[],
): TimelineSlot[] {
  let cursor = startAtIso ? new Date(startAtIso).getTime() : null;

  return activities.map((activity) => {
    const minutes = activity.durationMinutes ?? DEFAULT_ACTIVITY_MINUTES;
    const startAt = cursor != null ? new Date(cursor).toISOString() : null;
    if (cursor != null) cursor += minutes * 60_000;
    const endAt = cursor != null ? new Date(cursor).toISOString() : null;
    return { ...activity, minutes, startAt, endAt };
  });
}

export function totalActivityMinutes(activities: TimelineInput[]): number {
  return activities.reduce(
    (sum, activity) => sum + (activity.durationMinutes ?? DEFAULT_ACTIVITY_MINUTES),
    0,
  );
}

export function totalActivityCents(activities: TimelineInput[]): number {
  return activities.reduce((sum, activity) => sum + (activity.costCents ?? 0), 0);
}
