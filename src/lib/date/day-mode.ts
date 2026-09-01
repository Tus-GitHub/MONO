import { buildTimeline, type TimelineInput, type TimelineSlot } from "@/lib/date/timeline";

/**
 * Date Day Mode — pure logic that turns a date's timeline and the current wall-clock time
 * into "what's happening right now / what's next", so the day view can stay glanceable and
 * advance on its own without the couple ticking anything off.
 *
 * Times on a plan are stored UTC-encoded wall clock (see plan-service). "Now" is passed in as
 * minutes since local midnight — on the day of the date, the couple's device clock and the
 * plan's wall clock line up.
 */

export type DayPhase = "before" | "during" | "after" | "untimed";

export interface DaySlot extends TimelineSlot {
  index: number;
  startMinutes: number | null;
  endMinutes: number | null;
}

export interface DayView {
  phase: DayPhase;
  slots: DaySlot[];
  currentIndex: number | null;
  nextIndex: number | null;
  /** Minutes until the first activity begins (>= 0), when the phase is "before". */
  minutesToStart: number | null;
  /** Minutes since the last activity ended (>= 0), when the phase is "after". */
  minutesSinceEnd: number | null;
}

/** "…T19:30:…" (UTC-encoded wall clock) → 1170 minutes since midnight. */
function isoWallMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const hh = Number(iso.slice(11, 13));
  const mm = Number(iso.slice(14, 16));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

export function buildDayView(
  startIso: string | null,
  activities: TimelineInput[],
  nowMinutes: number,
): DayView {
  const slots: DaySlot[] = buildTimeline(startIso, activities).map((slot, index) => ({
    ...slot,
    index,
    startMinutes: isoWallMinutes(slot.startAt),
    endMinutes: isoWallMinutes(slot.endAt),
  }));

  if (slots.length === 0) {
    return {
      phase: "untimed",
      slots,
      currentIndex: null,
      nextIndex: null,
      minutesToStart: null,
      minutesSinceEnd: null,
    };
  }

  const firstStart = slots[0].startMinutes;
  const lastEnd = slots[slots.length - 1].endMinutes;

  if (firstStart == null || lastEnd == null) {
    // No start time on the plan — order is known, the clock isn't.
    return {
      phase: "untimed",
      slots,
      currentIndex: null,
      nextIndex: 0,
      minutesToStart: null,
      minutesSinceEnd: null,
    };
  }

  if (nowMinutes < firstStart) {
    return {
      phase: "before",
      slots,
      currentIndex: null,
      nextIndex: 0,
      minutesToStart: firstStart - nowMinutes,
      minutesSinceEnd: null,
    };
  }

  if (nowMinutes >= lastEnd) {
    return {
      phase: "after",
      slots,
      currentIndex: null,
      nextIndex: null,
      minutesToStart: null,
      minutesSinceEnd: nowMinutes - lastEnd,
    };
  }

  const currentIndex = slots.findIndex(
    (slot) =>
      slot.startMinutes != null &&
      slot.endMinutes != null &&
      nowMinutes >= slot.startMinutes &&
      nowMinutes < slot.endMinutes,
  );
  const resolved = currentIndex === -1 ? 0 : currentIndex;

  return {
    phase: "during",
    slots,
    currentIndex: resolved,
    nextIndex: resolved + 1 < slots.length ? resolved + 1 : null,
    minutesToStart: null,
    minutesSinceEnd: null,
  };
}

/** "in 40 min" · "in 2h 10m" · "now". */
export function untilLabel(minutes: number | null): string {
  if (minutes == null) return "";
  if (minutes <= 0) return "now";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `in ${h}h ${m}m`;
  if (h) return `in ${h}h`;
  return `in ${m} min`;
}
