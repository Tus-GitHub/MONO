import { expect, it } from "vitest";
import { emptyLocalPlan } from "./local-plan";
import { afterMinutes, planStepErrors, withStartTime } from "./plan-validation";
import { buildTimeline } from "./timeline";

it("defaults evening to 19:00–21:00, follows automatic times, and preserves a custom end", () => {
  expect(withStartTime({ startTime: "", endTime: "" }, "19:00")).toEqual({ startTime: "19:00", endTime: "21:00" });
  expect(withStartTime({ startTime: "19:00", endTime: "21:00" }, "14:00").endTime).toBe("16:00");
  expect(withStartTime({ startTime: "19:00", endTime: "22:30" }, "14:00").endTime).toBe("22:30");
  expect(afterMinutes("23:00")).toBe("23:59");
});
it("keeps incomplete basics on the current step and rejects reversed clocks", () => {
  const plan = emptyLocalPlan("INR");
  expect(Object.keys(planStepErrors(plan, "basics", "Asia/Kolkata"))).toEqual(expect.arrayContaining(["title", "date", "startTime", "endTime"]));
  Object.assign(plan, { title: "Café then cinema", date: "2099-01-01", startTime: "19:00", endTime: "18:00" });
  expect(planStepErrors(plan, "basics", "Asia/Kolkata").endTime).toBeTruthy();
  plan.endTime = "23:00";
  expect(planStepErrors(plan, "basics", "Asia/Kolkata")).toEqual({});
});
it("validates budget ranges and each event's name, amount and chronology", () => {
  const plan = { ...emptyLocalPlan("INR"), date: "2099-01-01", startTime: "19:00", endTime: "23:00", budgetMin: "500", budgetMax: "200" };
  expect(planStepErrors(plan, "budget", "UTC").budgetMax).toBeTruthy();
  plan.activities = [{ key: "a", title: "Café", savedPlaceId: "", duration: "60", cost: "", startTime: "19:00", endTime: "20:00" },
    { key: "b", title: "", savedPlaceId: "", duration: "120", cost: "-2", startTime: "19:30", endTime: "22:00" }];
  expect(Object.keys(planStepErrors(plan, "activities", "UTC"))).toEqual(expect.arrayContaining(["activities.1.title", "activities.1.costCents", "activities.1.startTime"]));
});
it("renders independent venue/time stops and preserves a gap between café and cinema", () => {
  const slots = buildTimeline("2099-01-01T19:00:00.000Z", [
    { id: "a", title: "Coffee", placeName: "Café", durationMinutes: 60, costCents: 100, startTime: "19:00", endTime: "20:00" },
    { id: "b", title: "Movie", placeName: "Cinema", durationMinutes: 120, costCents: 200, startTime: "21:00", endTime: "23:00" },
  ]);
  expect(slots[1]).toMatchObject({ placeName: "Cinema", startAt: "2099-01-01T21:00:00.000Z", endAt: "2099-01-01T23:00:00.000Z", minutes: 120 });
});
