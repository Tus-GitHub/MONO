"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { isPlanStep, planGotoHref, planStepHref } from "@/lib/date/plan-steps";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { localPlanSchema } from "@/lib/validation/new-plan";
import { saveNewPlan } from "@/server/services/new-plan-service";
import { idSchema, toFieldErrors } from "@/lib/validation/common";
import {
  dateBasicsSchema,
  dateBudgetSchema,
  plannedActivitySchema,
  reorderActivitiesSchema,
} from "@/lib/validation/date";
import {
  addActivity,
  cancelDate,
  deleteActivity,
  deleteDatePlan,
  finalizePlan,
  reorderActivities,
  updateActivity,
  updateBasics,
  updateBudget,
} from "@/server/services/plan-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

// --- start a new plan --------------------------------------------------------

export async function startPlanAction(formData: FormData): Promise<void> {
  const place = formData.get("place");
  const idea = formData.get("idea");
  const params = new URLSearchParams();
  if (typeof place === "string" && idSchema.safeParse(place).success) params.set("place", place);
  if (typeof idea === "string" && idea) params.set("idea", idea.slice(0, 160));
  redirect(`/plan/new${params.size ? `?${params}` : ""}`);
}

export async function saveNewPlanAction(_previous: ActionState<{ id: string; href: string }>, form: FormData): Promise<ActionState<{ id: string; href: string }>> {
  const raw = form.get("payload");
  if (typeof raw !== "string" || raw.length > 50_000) return { status: "error", message: "This plan is too large to save." };
  const mode = form.get("mode");
  const goto = String(form.get("goto") ?? "review");
  if (!["draft", "plan"].includes(String(mode)) || !isPlanStep(goto)) return { status: "error", message: "Choose Save draft or Save date." };
  try {
    const input = localPlanSchema.extend({ key: localPlanSchema.shape.key.uuid() }).parse(JSON.parse(raw));
    const saved = await saveNewPlan(input, mode === "plan");
    revalidatePath("/plan");
    revalidatePath("/dates");
    return successState({ id: saved.id, href: saved.status === "DRAFT" ? planStepHref(saved.id, goto) : `/dates/${saved.id}` }, "Saved.");
  } catch (error) {
    if (error instanceof ZodError) return errorState(error.issues[0]?.message ?? "Check your plan details.", toFieldErrors(error));
    const result = toActionError(error);
    return result.status === "error" ? result : { status: "error", message: "Couldn't save that plan." };
  }
}

// --- step saves (basics + budget share one action) -------------------------

function dateId(formData: FormData): string {
  return idSchema.parse(formData.get("dateId"));
}

export async function saveStepAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedId = idSchema.safeParse(formData.get("dateId"));
  if (!parsedId.success) return errorState("Choose a valid date plan.");
  const id = parsedId.data;
  const rawVersion = formData.get("version");
  const version = typeof rawVersion === "string" && /^\d+$/.test(rawVersion) ? Number(rawVersion) : NaN;
  if (!Number.isSafeInteger(version)) return errorState("Reload this plan before saving; your device draft is kept.");
  const step = String(formData.get("step") ?? "basics");
  const goto = String(formData.get("goto") ?? "budget");
  if (step !== "basics" && step !== "budget") return errorState("Choose a valid planning step.");
  if (goto !== "exit" && !isPlanStep(goto)) return errorState("Choose a valid next step.");
  const values = formValues(formData);

  try {
    if (step === "basics") {
      const parsed = dateBasicsSchema.safeParse(values);
      if (!parsed.success) {
        return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
      }
      await updateBasics(id, parsed.data, version);
    } else if (step === "budget") {
      const parsed = dateBudgetSchema.safeParse(values);
      if (!parsed.success) {
        return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
      }
      await updateBudget(id, parsed.data, version);
    }
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/plan/${id}`);
  redirect(planGotoHref(id, goto));
}

// --- activities (interactive; each mutation persists immediately) ---------

export async function addActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  const parsed = plannedActivitySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Add a name for the activity.", toFieldErrors(parsed.error));
  }
  try {
    await addActivity(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/plan/${id}`);
  return successState(undefined, "Added.");
}

export async function updateActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  const activityId = idSchema.parse(formData.get("activityId"));
  const parsed = plannedActivitySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the activity details.", toFieldErrors(parsed.error));
  }
  try {
    await updateActivity(id, activityId, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/plan/${id}`);
  return successState(undefined, "Saved.");
}

export async function deleteActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  const activityId = idSchema.parse(formData.get("activityId"));
  try {
    await deleteActivity(id, activityId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/plan/${id}`);
  return successState(undefined, "Removed.");
}

export async function reorderActivitiesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  const parsed = reorderActivitiesSchema.safeParse({ ids: formData.get("ids") });
  if (!parsed.success) return errorState("Couldn't save that order.");
  try {
    await reorderActivities(id, parsed.data.ids);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/plan/${id}`);
  return successState(undefined, "Reordered.");
}

// --- save & finish ---------------------------------------------------------

export async function finalizePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  try {
    await finalizePlan(id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect(`/dates/${id}?planned=1`);
}

export async function duplicateDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  redirect(`/plan/new?copy=${encodeURIComponent(id)}`);
}

export async function cancelDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  const reason = formData.get("reason");
  try {
    await cancelDate(id, typeof reason === "string" ? reason : undefined);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect(`/dates/${id}`);
}

export async function deleteDatePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  try {
    await deleteDatePlan(id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/plan");
}
