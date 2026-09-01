"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema, toFieldErrors } from "@/lib/validation/common";
import {
  dateMemorySchema,
  reviewDraftSchema,
  reviewSubmitSchema,
  revisitDecisionSchema,
} from "@/lib/validation/date";
import { deleteMemory, saveMemory } from "@/server/services/memory-service";
import {
  deleteReview,
  reopenReview,
  saveReviewDraft,
  submitReview,
} from "@/server/services/review-service";
import { saveRevisit } from "@/server/services/revisit-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

function dateIdFrom(formData: FormData): string {
  return idSchema.parse(formData.get("dateId"));
}

/** Pull `score:<categoryId>` fields into `{ [categoryId]: number }` (1–10, blank = skipped). */
function categoryScores(formData: FormData): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("score:") || typeof value !== "string" || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 1) scores[key.slice(6)] = Math.round(parsed);
  }
  return scores;
}

/** Save a private review draft — nothing revealed, half-answers fine, no redirect. */
export async function saveReviewDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = reviewDraftSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Some of that didn't save.", toFieldErrors(parsed.error));
  }
  try {
    await saveReviewDraft(id, parsed.data, categoryScores(formData));
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`, "layout");
  revalidatePath("/", "layout");
  return successState(undefined, "Draft saved. It stays private.");
}

/** Lock your side in. Requires the overall score and the revisit call. */
export async function submitReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = reviewSubmitSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState(
      "Add an overall score and choose whether you'd go again.",
      toFieldErrors(parsed.error),
    );
  }
  try {
    await submitReview(id, parsed.data, categoryScores(formData));
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`, "layout");
  revalidatePath("/", "layout");
  redirect(`/dates/${id}/review`);
}

/** Re-open a submitted-but-not-yet-revealed review for another pass. */
export async function reopenReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  try {
    await reopenReview(id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}/review`);
  redirect(`/dates/${id}/review`);
}

export async function deleteReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  try {
    await deleteReview(id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`, "layout");
  revalidatePath("/", "layout");
  redirect(`/dates/${id}`);
}

export async function saveRevisitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = revisitDecisionSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Pick one of yes, maybe, or no.", toFieldErrors(parsed.error));
  }
  try {
    await saveRevisit(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`);
  revalidatePath("/", "layout");
  return successState(undefined, "Saved.");
}

export async function saveMemoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  const parsed = dateMemorySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Give the memory a title and a few words.", toFieldErrors(parsed.error));
  }
  try {
    await saveMemory(id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`);
  revalidatePath("/", "layout");
  redirect(`/dates/${id}`);
}

export async function deleteMemoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = dateIdFrom(formData);
  try {
    await deleteMemory(id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${id}`);
  revalidatePath("/", "layout");
  redirect(`/dates/${id}`);
}
