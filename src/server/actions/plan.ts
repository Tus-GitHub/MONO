"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { planGotoHref, planStepHref } from "@/lib/date/plan-steps";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
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
  duplicateDate,
  finalizePlan,
  reorderActivities,
  startDraft,
  updateActivity,
  updateBasics,
  updateBudget,
} from "@/server/services/plan-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

// --- start a new plan --------------------------------------------------------

export async function startPlanAction(formData: FormData): Promise<void> {
  const place = formData.get("place");
  const idea = formData.get("idea");
  const draft = await startDraft({
    plannedPlaceId: typeof place === "string" && place ? place : undefined,
    title: typeof idea === "string" && idea ? idea : undefined,
  });
  redirect(planStepHref(draft.id, "basics"));
}

// --- step saves (basics + budget share one action) -------------------------

function dateId(formData: FormData): string {
  return idSchema.parse(formData.get("dateId"));
}

export async function saveStepAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateId(formData);
  const step = String(formData.get("step") ?? "basics");
  const goto = String(formData.get("goto") ?? "budget");
  const values = formValues(formData);

  try {
    if (step === "basics") {
      const parsed = dateBasicsSchema.safeParse(values);
      if (!parsed.success) {
        return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
      }
      await updateBasics(id, parsed.data);
    } else if (step === "budget") {
      const parsed = dateBudgetSchema.safeParse(values);
      if (!parsed.success) {
        return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
      }
      await updateBudget(id, parsed.data);
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
  let copy: { id: string };
  try {
    copy = await duplicateDate(id);
  } catch (error) {
    return toActionError(error);
  }
  redirect(planStepHref(copy.id, "basics"));
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
