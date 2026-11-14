const DEFAULT_ACTIVITY_MINUTES = 60;

export interface TimelineInput {
  id: string;
  title: string;
  durationMinutes: number | null;
  costCents: number | null;
  startAt?: string | null;
  endAt?: string | null;
  startTime?: string;
  endTime?: string;
  placeName?: string | null;
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
    const day = startAtIso?.slice(0, 10) ?? "1970-01-01";
    const clock = (iso?: string | null, wall?: string) => {
      const value = iso ?? (wall ? `${day}T${wall}:00.000Z` : null);
      const time = value ? new Date(value).getTime() : NaN;
      return Number.isFinite(time) ? time : null;
    };
    const begins = clock(activity.startAt, activity.startTime) ?? cursor;
    const explicitEnd = clock(activity.endAt, activity.endTime);
    const finishes = begins != null ? (explicitEnd != null && explicitEnd > begins ? explicitEnd : begins + (activity.durationMinutes ?? DEFAULT_ACTIVITY_MINUTES) * 60_000) : null;
    const minutes = begins != null && finishes != null ? Math.round((finishes - begins) / 60_000) : activity.durationMinutes ?? DEFAULT_ACTIVITY_MINUTES;
    const startAt = begins != null ? new Date(begins).toISOString() : null;
    const endAt = finishes != null ? new Date(finishes).toISOString() : null;
    cursor = finishes;
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
