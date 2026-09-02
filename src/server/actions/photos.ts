"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema } from "@/lib/validation/common";
import { photoCaptionSchema } from "@/lib/validation/date";
import {
  deleteDatePhoto,
  getBestPhotoWallPage,
  setBestCouplePhoto,
  setPhotoCaption,
  togglePhotoFavorite,
  type PhotoWallPage,
} from "@/server/services/photo-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

/** "Load more" for the photo wall — read-only, couple-scoped inside the service. */
export async function loadMoreBestPhotosAction(cursor: string): Promise<PhotoWallPage> {
  if (typeof cursor !== "string" || cursor.length > 40) {
    return { photos: [], nextCursor: null };
  }
  try {
    return await getBestPhotoWallPage(cursor);
  } catch {
    return { photos: [], nextCursor: null };
  }
}

/** Heart / un-heart a photo for the couple photo wall. */
export async function togglePhotoFavoriteAction(
  _prev: ActionState<{ favorite: boolean }>,
  formData: FormData,
): Promise<ActionState<{ favorite: boolean }>> {
  const photoId = idSchema.parse(formData.get("photoId"));
  const dateId = formData.get("dateId");
  let favorite: boolean;
  try {
    favorite = await togglePhotoFavorite(photoId);
  } catch (error) {
    return toActionError(error);
  }
  if (typeof dateId === "string" && dateId) revalidatePath(`/dates/${dateId}`);
  revalidatePath("/memories", "layout");
  return successState({ favorite }, favorite ? "Added to favourites." : "Removed.");
}

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
