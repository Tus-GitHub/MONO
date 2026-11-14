import type { LocalPlan } from "@/lib/validation/new-plan";
import { dateBasicsSchema, dateBudgetSchema, plannedActivitySchema } from "@/lib/validation/date";
import type { PlanStep } from "./plan-steps";
import { todayYmdInTimeZone } from "@/lib/utils/timezone";

export function afterMinutes(time: string, duration = 120): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "";
  const minutes = Math.min(1439, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + duration);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function withStartTime<T extends { startTime: string; endTime: string }>(draft: T, startTime: string): T {
  return { ...draft, startTime, endTime: !draft.endTime || draft.endTime === afterMinutes(draft.startTime) ? afterMinutes(startTime) : draft.endTime };
}

/** Drafts may be incomplete; moving forward requires a valid, complete current step. */
export function planStepErrors(plan: LocalPlan, step: PlanStep, timezone: string): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (key: string, message: string) => { (errors[key] ??= []).push(message); };
  if (step === "basics" || step === "review") {
    const result = dateBasicsSchema.safeParse(plan);
    if (!result.success) for (const issue of result.error.issues) add(String(issue.path[0]), issue.message);
    if (!plan.title.trim()) add("title", "Give your date a name.");
    if (!plan.date) add("date", "Choose a date.");
    else if (plan.date < todayYmdInTimeZone(timezone)) add("date", "Pick today or a future date.");
    if (!plan.startTime) add("startTime", "Choose a start time.");
    if (!plan.endTime) add("endTime", "Choose an end time.");
  }
  if (step === "budget" || step === "review") {
    const result = dateBudgetSchema.safeParse(plan);
    if (!result.success) for (const issue of result.error.issues) add(String(issue.path[0]), issue.message);
  }
  if (step === "activities" || step === "review") {
    let previousEnd = "";
    plan.activities.forEach((stop, index) => {
      const prefix = `activities.${index}.`;
      const result = plannedActivitySchema.safeParse({ title: stop.title, durationMinutes: stop.duration, costCents: stop.cost, savedPlaceId: stop.savedPlaceId,
        startTime: stop.startTime, endTime: stop.endTime, placeSelection: stop.place?.selection, description: stop.description });
      if (!result.success) for (const issue of result.error.issues) add(prefix + String(issue.path[0]), issue.message);
      if (stop.startTime && previousEnd && stop.startTime < previousEnd) add(prefix + "startTime", "This event starts before the previous event ends.");
      if (stop.startTime && plan.startTime && stop.startTime < plan.startTime) add(prefix + "startTime", "This event starts before the date. Update the start time in Basics.");
      if (stop.endTime && plan.endTime && stop.endTime > plan.endTime) add(prefix + "endTime", "This event ends after the date. Update the end time in Basics.");
      previousEnd = stop.endTime || afterMinutes(stop.startTime || previousEnd || plan.startTime, Number(stop.duration) || 60);
    });
  }
  return errors;
}
