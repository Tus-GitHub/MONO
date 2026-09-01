/** Formatting helpers — deterministic, dependency-free. */

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(
  value: Date | string | null | undefined,
  style: "full" | "long" | "medium" | "short" = "medium",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: style }).format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatTimeRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

/** "in 3 days" · "Tomorrow" · "Today" · "2 hours ago". Rounds to the largest sensible unit. */
export function relativeTime(target: Date | string, now: Date = new Date()): string {
  const date = typeof target === "string" ? new Date(target) : target;
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < 45 * minute) {
    const mins = Math.max(1, Math.round(abs / minute));
    return diffMs >= 0 ? `in ${mins} min` : `${mins} min ago`;
  }
  if (abs < 22 * hour) {
    const hrs = Math.round(abs / hour);
    return diffMs >= 0 ? `in ${hrs} hour${hrs === 1 ? "" : "s"}` : `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(abs / day);
  if (days === 1) return diffMs >= 0 ? "Tomorrow" : "Yesterday";
  if (days < 14) return diffMs >= 0 ? `in ${days} days` : `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return diffMs >= 0 ? `in ${weeks} weeks` : `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  return diffMs >= 0 ? `in ${months} month${months === 1 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"} ago`;
}

/** Countdown phrasing for an upcoming date: "Happening now" / "Today" / "in 3 days". */
export function countdownLabel(target: Date | string, now: Date = new Date()): string {
  const when = typeof target === "string" ? new Date(target) : target;
  const diff = when.getTime() - now.getTime();
  const hour = 3_600_000;
  if (diff <= 0 && diff > -6 * hour) return "Happening now";
  if (diff > 0 && diff < 22 * hour) return "Today";
  return relativeTime(when, now);
}

/** True when `value` falls on the same calendar day as `now`. */
export function isSameDay(value: Date | string, now: Date = new Date()): boolean {
  const d = typeof value === "string" ? new Date(value) : value;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** "19:00" → "7:00 PM". Formats a wall-clock string without timezone conversion. */
export function formatWallTime(hhmm: string | null | undefined): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** ISO → "HH:MM" wall clock (the flow stores planned times UTC-encoded). */
export function wallTimeFromIso(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "";
}

/** "2026-09-05" → "Friday, September 5" (no timezone shift). */
export function formatWallDate(ymd: string | null | undefined, style: "full" | "long" | "medium" = "full"): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: style, timeZone: "UTC" }).format(
    new Date(`${ymd}T12:00:00.000Z`),
  );
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function possessiveNames(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "you two";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}
