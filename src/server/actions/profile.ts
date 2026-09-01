"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { toFieldErrors } from "@/lib/validation/common";
import { updateProfileSchema } from "@/lib/validation/profile";
import { markProfileComplete, updateProfile } from "@/server/services/profile-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

/** Save profile edits without leaving the current page (used from Couple → profile later). */
export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateProfileSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  try {
    await updateProfile(user.id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  return successState(undefined, "Profile saved.");
}

/** Onboarding step 1: save the profile and advance. */
export async function completeProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateProfileSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  try {
    await updateProfile(user.id, parsed.data);
    await markProfileComplete(user.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
