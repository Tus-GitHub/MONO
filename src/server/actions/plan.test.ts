import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateBasics: vi.fn(), updateBudget: vi.fn(), getPlan: vi.fn(), finalizePlan: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("@/server/services/plan-service", () => ({
  updateBasics: mocks.updateBasics, updateBudget: mocks.updateBudget,
  getPlan: mocks.getPlan, finalizePlan: mocks.finalizePlan,
}));
vi.mock("@/server/services/new-plan-service", () => ({ saveNewPlan: vi.fn() }));
import { saveStepAction, startPlanAction, duplicateDateAction, finalizePlanAction } from "./plan";

beforeEach(() => vi.resetAllMocks());

it.each([{ startTime: null, endTime: null }, { startTime: "19:00", endTime: "18:00" }])("rejects an incomplete or reversed schedule at the existing-draft Save boundary: %j", async (times) => {
  mocks.getPlan.mockResolvedValue({ title: "Coffee", date: "2099-01-01", ...times });
  const form = new FormData(); form.set("dateId", "date");
  expect(await finalizePlanAction({ status: "idle" }, form)).toMatchObject({ status: "error" });
  expect(mocks.finalizePlan).not.toHaveBeenCalled();
});
it("finalizes a valid existing schedule before navigating", async () => {
  mocks.getPlan.mockResolvedValue({ title: "Coffee", date: "2099-01-01", startTime: "19:00", endTime: "21:00" });
  const form = new FormData(); form.set("dateId", "date");
  await expect(finalizePlanAction({ status: "idle" }, form)).rejects.toThrow("redirect:/dates/date?planned=1");
  expect(mocks.finalizePlan).toHaveBeenCalledWith("date");
});

it("opens a local new-plan editor without creating a date record", async () => {
 const form = new FormData(); form.set("idea", "Dinner");
 await expect(startPlanAction(form)).rejects.toThrow("redirect:/plan/new?idea=Dinner");
 expect(mocks.updateBasics).not.toHaveBeenCalled();
});
it("prepares a local copy without immediately saving a duplicate", async () => {
 const form = new FormData(); form.set("dateId", "date");
 await expect(duplicateDateAction({status:"idle"},form)).rejects.toThrow("redirect:/plan/new?copy=date");
});

it.each([
  { dateId: "", step: "basics", goto: "budget" },
  { dateId: "date", step: "unknown", goto: "budget" },
  { dateId: "date", step: "basics", goto: "https://example.com" },
])("rejects invalid step routing before writing: %j", async (fields) => {
  const form = new FormData();
  form.set("version", "0");
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  expect(await saveStepAction({ status: "idle" }, form)).toMatchObject({ status: "error" });
  expect(mocks.updateBasics).not.toHaveBeenCalled();
  expect(mocks.updateBudget).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});

it("saves valid basics before redirecting to the next step", async () => {
  const form = new FormData();
  Object.entries({ dateId: "date", version: "0", step: "basics", goto: "budget", title: "Dinner", date: "2099-01-01", startTime: "19:00", endTime: "21:00" })
    .forEach(([key, value]) => form.set(key, value));
  await expect(saveStepAction({ status: "idle" }, form)).rejects.toThrow("redirect:/plan/date?step=budget");
  expect(mocks.updateBasics).toHaveBeenCalledWith("date", expect.objectContaining({ title: "Dinner" }), 0);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/plan/date");
});
