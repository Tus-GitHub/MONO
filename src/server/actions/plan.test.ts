import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateBasics: vi.fn(), updateBudget: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("@/server/services/plan-service", () => ({
  updateBasics: mocks.updateBasics, updateBudget: mocks.updateBudget,
}));
vi.mock("@/server/services/new-plan-service", () => ({ saveNewPlan: vi.fn() }));
import { saveStepAction, startPlanAction, duplicateDateAction } from "./plan";

beforeEach(() => vi.resetAllMocks());

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
  Object.entries({ dateId: "date", version: "0", step: "basics", goto: "budget", title: "Dinner" })
    .forEach(([key, value]) => form.set(key, value));
  await expect(saveStepAction({ status: "idle" }, form)).rejects.toThrow("redirect:/plan/date?step=budget");
  expect(mocks.updateBasics).toHaveBeenCalledWith("date", expect.objectContaining({ title: "Dinner" }), 0);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/plan/date");
});
