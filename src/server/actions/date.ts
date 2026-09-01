"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCoupleContext } from "@/lib/authz";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema, toFieldErrors } from "@/lib/validation/common";
import {
  actualActivitySchema,
  dateActualsSchema,
  reorderActivitiesSchema,
  transitionDateSchema,
} from "@/lib/validation/date";
import {
  addActualActivity,
  deleteActualActivity,
  reorderActualActivities,
  seedActualsFromPlan,
  updateActualActivity,
} from "@/server/services/actuals-service";
import { markDateActivitySeen } from "@/server/services/date-event-service";
import { recordActuals, transitionDate } from "@/server/services/date-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

function dateIdFrom(formData: FormData): string {
  return idSchema.parse(formData.get("dateId"));
}

/** Move a date through its lifecycle. The service enforces valid transitions. */
export async function transitionDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const parsed = transitionDateSchema.safeParse(formValues(formData));
  if (!parsed.success) return errorState("That status change isn't valid.");

  try {
    await transitionDate(dateId, parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dates/${dateId}`);
  revalidatePath("/", "layout");
  return successState(undefined, "Updated.");
}

/** Mark the couple's date activity as seen (clears the "your partner changed…" indicator). */
export async function markDatesSeenAction(): Promise<void> {
  const { user, couple } = await requireCoupleContext();
  await markDateActivitySeen(couple.id, user.id);
}

// --- "How did it actually go?" -------------------------------------------------

/** Save what actually happened (scalars: place, day, times, spend, notes). */
export async function recordActualsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = dateActualsSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  try {
    await recordActuals(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`);
  revalidatePath("/", "layout");
  redirect(`/dates/${id}`);
}

export async function addActualActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = actualActivitySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Add a name for the activity.", toFieldErrors(parsed.error));
  }
  try {
    await addActualActivity(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}/recap`);
  revalidatePath(`/dates/${id}`);
  return successState(undefined, "Added.");
}

export async function updateActualActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const activityId = idSchema.parse(formData.get("activityId"));
  const parsed = actualActivitySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the activity details.", toFieldErrors(parsed.error));
  }
  try {
    await updateActualActivity(id, activityId, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}/recap`);
  revalidatePath(`/dates/${id}`);
  return successState(undefined, "Saved.");
}

export async function deleteActualActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const activityId = idSchema.parse(formData.get("activityId"));
  try {
    await deleteActualActivity(id, activityId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}/recap`);
  revalidatePath(`/dates/${id}`);
  return successState(undefined, "Removed.");
}

export async function reorderActualActivitiesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = reorderActivitiesSchema.safeParse({ ids: formData.get("ids") });
  if (!parsed.success) return errorState("Couldn't save that order.");
  try {
    await reorderActualActivities(id, parsed.data.ids);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}/recap`);
  return successState(undefined, "Reordered.");
}

export async function seedActualsFromPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  try {
    await seedActualsFromPlan(id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}/recap`);
  revalidatePath(`/dates/${id}`);
  return successState(undefined, "Copied the plan — edit anything that went differently.");
}
