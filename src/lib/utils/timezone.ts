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
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
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
