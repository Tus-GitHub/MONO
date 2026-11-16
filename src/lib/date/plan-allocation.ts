import type { LocalPlan } from "@/lib/validation/new-plan";
import { planStepErrors } from "./plan-validation";

export function clockMinutes(time?: string): number | null {
  return time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : null;
}

export function minutesLabel(minutes: number): string {
  const value = Math.max(0, minutes);
  const hours = Math.floor(value / 60), rest = value % 60;
  return [hours ? `${hours} hr` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ") || "0 min";
}

export function timeSpan(start?: string, end?: string): number {
  const a = clockMinutes(start), b = clockMinutes(end);
  return a != null && b != null && b > a ? b - a : 0;
}

export function amountCents(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 ? Math.round(amount * 100) : null;
}

export function planAllocation(plan: LocalPlan) {
  const totalMinutes = timeSpan(plan.startTime, plan.endTime);
  const usedMinutes = plan.activities.reduce((sum, event) => sum + timeSpan(event.startTime, event.endTime), 0);
  const totalCents = amountCents(plan.expectedTotal);
  const usedCents = plan.activities.reduce((sum, event) => sum + (amountCents(event.cost) ?? 0), 0);
  return { totalMinutes, usedMinutes, freeMinutes: totalMinutes - usedMinutes,
    totalCents, usedCents, remainingCents: totalCents == null ? null : totalCents - usedCents };
}

/** Find a free interval inside the chosen day. Never extend the date or wrap past midnight. */
export function nextEventTimes(plan: LocalPlan, requestedMinutes: number) {
  const start = clockMinutes(plan.startTime), end = clockMinutes(plan.endTime);
  if (start == null || end == null || end <= start) return null;
  const slots = plan.activities.flatMap((event) => {
    const a = clockMinutes(event.startTime), b = clockMinutes(event.endTime);
    return a != null && b != null && b > a ? [{ start: a, end: b }] : [];
  }).sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let cursor = start;
  for (const slot of slots) {
    if (slot.start > cursor) gaps.push({ start: cursor, end: Math.min(end, slot.start) });
    cursor = Math.max(cursor, slot.end);
  }
  if (cursor < end) gaps.push({ start: cursor, end });
  const duration = Math.max(5, Math.round(requestedMinutes));
  const candidates = gaps.filter((gap) => gap.end - gap.start >= 5);
  // Prefer a full-length slot. Leave travel time after a preceding event when it fits.
  const gap = candidates.find((item) => item.end - item.start >= duration) ?? candidates[0];
  if (!gap) return null;
  const from = gap.start + (gap.start > start && gap.end - gap.start >= duration + 15 ? 15 : 0);
  const to = Math.min(gap.end, from + duration);
  const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  return { startTime: clock(from), endTime: clock(to), duration: String(to - from), shortened: to - from < duration };
}

export function orderedEvents(events: LocalPlan["activities"]) {
  return [...events].sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
}

/** Rules for the simplified planner, shared by the UI and the explicit save boundary. */
export function plannerErrors(plan: LocalPlan, timezone: string, overviewOnly = false): Record<string, string[]> {
  const errors = overviewOnly
    ? { ...planStepErrors(plan, "basics", timezone), ...planStepErrors(plan, "budget", timezone) }
    : planStepErrors(plan, "review", timezone);
  const add = (key: string, message: string) => { (errors[key] ??= []).push(message); };
  if (!plan.expectedTotal.trim()) add("expectedTotal", "Set a total budget. Enter 0 for a free date.");
  if (overviewOnly) return errors;
  if (!plan.activities.length) add("activities", "Add at least one event to your date.");
  for (const [index, event] of plan.activities.entries()) {
    if (!event.startTime) add(`activities.${index}.startTime`, "Choose when this event starts.");
    if (!event.endTime) add(`activities.${index}.endTime`, "Choose when this event ends.");
    if (!event.cost.trim()) add(`activities.${index}.costCents`, "Add an estimate. Enter 0 if it is free.");
    const span = timeSpan(event.startTime, event.endTime);
    if (span > 0 && span < 5) add(`activities.${index}.endTime`, "Allow at least 5 minutes for an event.");
  }
  const { remainingCents } = planAllocation(plan);
  if (remainingCents != null && remainingCents < 0) add("allocation", "Event estimates exceed your total budget. Adjust an event or increase the budget.");
  return errors;
}
