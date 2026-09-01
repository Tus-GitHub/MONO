"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema } from "@/lib/validation/common";
import { photoCaptionSchema } from "@/lib/validation/date";
import {
  deleteDatePhoto,
  setBestCouplePhoto,
  setPhotoCaption,
} from "@/server/services/photo-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

/** Part 4 — "Pick the photo that feels most like us." An empty photoId clears it. */
export async function setBestCouplePhotoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const raw = formData.get("photoId");
  const photoId = typeof raw === "string" && raw.trim() ? idSchema.parse(raw.trim()) : null;
  try {
    await setBestCouplePhoto(dateId, photoId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${dateId}`);
  revalidatePath("/", "layout");
  return successState(undefined, photoId ? "Set as your best photo." : "Cleared.");
}

export async function setPhotoCaptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const photoId = idSchema.parse(formData.get("photoId"));
  const parsed = photoCaptionSchema.safeParse(formValues(formData));
  if (!parsed.success) return errorState("That caption is too long.");
  try {
    await setPhotoCaption(photoId, parsed.data.caption);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${dateId}`);
  return successState(undefined, "Saved.");
}

export async function deleteDatePhotoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const photoId = idSchema.parse(formData.get("photoId"));
  try {
    await deleteDatePhoto(photoId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${dateId}`);
  revalidatePath("/", "layout");
  return successState(undefined, "Removed.");
}
