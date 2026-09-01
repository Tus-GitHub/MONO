"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema, toFieldErrors } from "@/lib/validation/common";
import { customPlaceSchema, selectPlaceSchema } from "@/lib/validation/place";
import {
  clearDatePlannedPlace,
  createCustomPlace,
  saveAndFavorite,
  setActivityPlace,
  setDatePlannedPlace,
  toggleFavorite,
} from "@/server/services/place-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

type FavoriteData = { placeId: string; favorite: boolean };

/** Heart on a place card. Saves external/custom places on first tap, then favourites them. */
export async function toggleFavoriteAction(
  _prev: ActionState<FavoriteData>,
  formData: FormData,
): Promise<ActionState<FavoriteData>> {
  const parsed = selectPlaceSchema.safeParse(formValues(formData));
  if (!parsed.success) return errorState("Couldn't save that place.");

  try {
    if (parsed.data.mode === "saved") {
      const favorite = await toggleFavorite(parsed.data.savedPlaceId);
      return successState({ placeId: parsed.data.savedPlaceId, favorite });
    }
    const summary = await saveAndFavorite(parsed.data);
    return successState({ placeId: summary.id, favorite: true });
  } catch (error) {
    return toActionError(error);
  }
}

/** Standalone "Custom place" from Explore (no active date). */
export async function createCustomPlaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customPlaceSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  let place;
  try {
    place = await createCustomPlace(parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/explore");
  redirect(`/places/${place.id}`);
}

/**
 * Choose a place (saved / external / custom) for the Date being planned. Returns success so an
 * in-flow picker can `router.refresh()` without losing form state; pass a `redirectTo` field
 * (an internal path) to navigate instead — used by full-page Explore.
 */
export async function selectPlaceForDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const parsed = selectPlaceSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the place details.", toFieldErrors(parsed.error));
  }

  try {
    await setDatePlannedPlace(dateId, parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/plan/${dateId}`);

  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    redirect(redirectTo);
  }
  return successState(undefined, "Place chosen.");
}

export async function clearDatePlaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  try {
    await clearDatePlannedPlace(dateId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/plan/${dateId}`);
  return successState(undefined, "Place removed.");
}

export async function setActivityPlaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const dateId = idSchema.parse(formData.get("dateId"));
  const activityId = idSchema.parse(formData.get("activityId"));
  const raw = formData.get("savedPlaceId");
  const savedPlaceId = typeof raw === "string" && raw ? raw : null;
  try {
    await setActivityPlace(dateId, activityId, savedPlaceId);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/plan/${dateId}`);
  return successState(undefined, "Saved.");
}
