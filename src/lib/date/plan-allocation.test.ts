import { expect, it } from "vitest";
import { emptyLocalPlan } from "./local-plan";
import { nextEventTimes, planAllocation, plannerErrors } from "./plan-allocation";

const plan = () => ({ ...emptyLocalPlan("INR", "Coffee, a movie & us"), date: "2099-01-01", startTime: "17:00", endTime: "22:00", expectedTotal: "2500" });
const event = (key: string, startTime: string, endTime: string, cost = "600") => ({ key, title: key, startTime, endTime, cost, duration: "60", savedPlaceId: "" });

it("keeps the overall date window and tracks time and budget across café then cinema", () => {
  const input = { ...plan(), activities: [event("Café", "17:00", "18:00"), event("Movie", "18:15", "20:15", "1200")] };
  expect(plannerErrors(input, "Asia/Kolkata")).toEqual({});
  expect(planAllocation(input)).toMatchObject({ totalMinutes: 300, usedMinutes: 180, freeMinutes: 120, totalCents: 250000, usedCents: 180000, remainingCents: 70000 });
  expect(input.endTime).toBe("22:00");
});
it("places new events inside the window with a travel gap when space allows", () => {
  const input = { ...plan(), activities: [event("Café", "17:00", "18:00")] };
  expect(nextEventTimes(input, 130)).toEqual({ startTime: "18:15", endTime: "20:25", duration: "130", shortened: false });
});
it("uses an earlier free interval when the end of the date is full", () => {
  const input = { ...plan(), activities: [event("Movie", "19:00", "22:00")] };
  expect(nextEventTimes(input, 45)).toMatchObject({ startTime: "17:00", endTime: "17:45" });
});
it("makes a shortened suggestion explicit and never spills into the next day", () => {
  const input = { ...plan(), startTime: "23:00", endTime: "23:59", activities: [] };
  expect(nextEventTimes(input, 120)).toEqual({ startTime: "23:00", endTime: "23:59", duration: "59", shortened: true });
  expect(nextEventTimes({ ...input, activities: [event("Walk", "23:00", "23:59", "0")] }, 5)).toBeNull();
});
it.each([
  [event("Café", "16:00", "18:00"), "activities.0.startTime"],
  [event("Café", "21:00", "23:00"), "activities.0.endTime"],
  [event("Café", "18:00", "17:00"), "activities.0.endTime"],
  [event("Café", "17:00", "17:01"), "activities.0.endTime"],
  [event("Café", "17:00", "18:00", ""), "activities.0.costCents"],
] as const)("rejects events outside the date or missing a valid estimate: %j", (item, key) => {
  expect(plannerErrors({ ...plan(), activities: [item] }, "UTC")[key]).toBeTruthy();
});
it("rejects overlapping events and combined estimates exceeding the budget", () => {
  const input = { ...plan(), activities: [event("Café", "17:00", "18:00", "1500"), event("Movie", "17:30", "20:00", "1500")] };
  expect(plannerErrors(input, "UTC")["activities.1.startTime"]).toBeTruthy();
  expect(plannerErrors(input, "UTC").allocation).toBeTruthy();
});
it("uses integer cents and accepts a fully specified free date", () => {
  const input = { ...plan(), expectedTotal: "0.3", activities: [event("a", "17:00", "18:00", "0.1"), event("b", "18:00", "19:00", "0.2")] };
  expect(planAllocation(input).remainingCents).toBe(0);
  expect(plannerErrors(input, "UTC")).toEqual({});
  expect(plannerErrors({ ...plan(), expectedTotal: "0", activities: [event("Walk", "17:00", "18:00", "0")] }, "UTC")).toEqual({});
});
it("requires the overview before adding events and at least one event before saving", () => {
  expect(plannerErrors(plan(), "UTC", true)).toEqual({});
  expect(plannerErrors({ ...plan(), expectedTotal: "" }, "UTC", true).expectedTotal).toBeTruthy();
  expect(plannerErrors(plan(), "UTC").activities).toBeTruthy();
});
