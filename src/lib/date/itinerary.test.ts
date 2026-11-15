import { expect, it } from "vitest";
import { emptyLocalPlan } from "./local-plan";
import { itineraryPlan, scheduleItinerary } from "./itinerary";
it("arranges a cafe, arcade, movie and hotel with travel gaps and one overall interval", () => {
  const stops = ["Café", "Arcade", "Movie", "Hotel"].map((title, i) => ({ key: String(i), title, duration: i > 1 ? "120" : "60", cost: "", savedPlaceId: "" }));
  const activities = scheduleItinerary(stops, "12:00");
  expect(activities.map((row) => [row.startTime, row.endTime])).toEqual([["12:00", "13:00"], ["13:15", "14:15"], ["14:30", "16:30"], ["16:45", "18:45"]]);
  expect(itineraryPlan({ ...emptyLocalPlan("INR"), activities })).toMatchObject({ title: "Our day out", startTime: "12:00", endTime: "18:45" });
});
it("does not silently wrap an itinerary past midnight or reuse a stale overall end", () => {
  const activities = scheduleItinerary([{ key: "a", title: "Movie", duration: "120", cost: "", savedPlaceId: "" }], "23:00");
  expect(activities[0].endTime).toBe("");
  expect(itineraryPlan({ ...emptyLocalPlan("INR"), endTime: "23:59", activities }).endTime).toBe("");
});
