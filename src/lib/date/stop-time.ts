import { ValidationError } from "@/lib/errors";

/** Planned stop clocks use the same UTC-encoded wall-time convention as their parent date. */
export function stopTimes(day: string | null | undefined, start?: string, end?: string) {
  if ((start || end) && !day) throw new ValidationError("Choose the date before setting stop times.");
  return { startAt: day && start ? new Date(`${day}T${start}:00.000Z`) : null,
    endAt: day && end ? new Date(`${day}T${end}:00.000Z`) : null };
}
