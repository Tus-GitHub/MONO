/**
 * Minimal IANA-timezone helpers built on `Intl` — no dependency. Reminders are scheduled at a
 * wall-clock time in the couple's own timezone (e.g. "09:00 on the day"), which is not the same
 * instant as 09:00 UTC once the couple isn't in UTC.
 */

/** How far ahead of UTC `timeZone` is at the given instant, in ms (handles DST). */
function tzOffsetMs(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = new Date(0);
  asUtc.setUTCFullYear(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  asUtc.setUTCHours(Number(parts.hour) % 24, Number(parts.minute), Number(parts.second), 0);
  return asUtc.getTime() - at.getTime();
}

/** A real instant formatted for a datetime-local field in the space's timezone. */
export function dateTimeInTimeZone(value: Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function isValidLocalDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 16) === value;
}

/** Reject DST gaps; for repeated local times choose the earlier real instant consistently. */
export function localDateTimeToUtc(value: string, timeZone: string): Date {
  if (!isValidLocalDateTime(value)) throw new RangeError("Invalid local date/time.");
  const naive = new Date(`${value}:00.000Z`).getTime();
  // Sampling either side finds both offsets around a clock change, including half-hour DST.
  const offsets = new Set([-2, -1, 0, 1, 2].map((days) => tzOffsetMs(new Date(naive + days * 86_400_000), timeZone)));
  const matches = [...offsets].map((offset) => new Date(naive - offset))
    .filter((candidate) => dateTimeInTimeZone(candidate, timeZone) === value)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!matches.length) throw new RangeError("This local time does not exist in this timezone.");
  return matches[0];
}

/** The UTC instant for `hour:minute` wall-clock on `ymd` (YYYY-MM-DD) in `timeZone`. */
export function zonedTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0);
  try {
    const guess = new Date(naive);
    const offset = tzOffsetMs(guess, timeZone);
    let result = new Date(naive - offset);
    const offset2 = tzOffsetMs(result, timeZone);
    if (offset2 !== offset) result = new Date(naive - offset2);
    return result;
  } catch {
    // Unknown timeZone — fall back to treating the wall time as UTC.
    return new Date(naive);
  }
}

/** Today's date (YYYY-MM-DD) as it reads in `timeZone`. */
export function todayYmdInTimeZone(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Convert the existing UTC-encoded plan wall clock to an actual instant, without changing its storage/display meaning. */
export function planTimeToInstant(value: Date | null, timeZone: string): Date | null {
  if (!value) return null;
  const ymd = value.toISOString().slice(0, 10);
  return zonedTimeToUtc(ymd, value.getUTCHours(), value.getUTCMinutes(), timeZone);
}

/** Local clock used by day-mode follows the couple timezone, including when a device is travelling. */
export function minutesInTimeZone(timeZone: string, now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now);
    return Number(parts.find((part) => part.type === "hour")?.value) * 60
      + Number(parts.find((part) => part.type === "minute")?.value);
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}
