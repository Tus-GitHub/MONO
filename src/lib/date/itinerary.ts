import type { LocalPlan } from "@/lib/validation/new-plan";

export function scheduleItinerary(stops: LocalPlan["activities"], start: string, gap = 15) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return stops;
  let cursor = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const clock = (minutes: number) => minutes >= 1440 ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return stops.map((stop) => {
    const duration = Math.max(1, Number(stop.duration) || 60);
    const timed = { ...stop, startTime: clock(cursor), endTime: clock(cursor + duration) };
    cursor += duration + gap;
    return timed;
  });
}

/** The route itself supplies the overall time/place; no second form to repeat them. */
export function itineraryPlan(plan: LocalPlan): LocalPlan {
  const first = plan.activities[0], last = plan.activities.at(-1);
  return { ...plan, title: plan.title.trim() || "Our day out", place: first ? first.place ?? null : plan.place,
    startTime: first ? first.startTime ?? "" : plan.startTime, endTime: last ? last.endTime ?? "" : plan.endTime };
}
