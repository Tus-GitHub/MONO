"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { requireUser } from "@/lib/auth/current-user";
import { requireCoupleContext } from "@/lib/authz";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { toFieldErrors } from "@/lib/validation/common";
import type { Theme } from "@/lib/settings/theme";
import {
  coupleProfileSchema,
  deleteAccountSchema,
  themeSchema,
  userSettingsSchema,
} from "@/lib/validation/settings";
import { deleteAccount } from "@/server/services/account-service";
import { disconnectCouple, updateCoupleProfile } from "@/server/services/couple-service";
import {
  setUserTheme,
  updateUserSettings,
} from "@/server/services/user-settings-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

const bool = (value: FormDataEntryValue | null) => value === "on" || value === "true";

export async function updateCoupleProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { couple } = await requireCoupleContext();
  const parsed = coupleProfileSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  try {
    await updateCoupleProfile(couple.id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/couple");
  revalidatePath("/settings/couple");
  revalidatePath("/", "layout");
  return successState(undefined, "Couple profile saved.");
}

export async function updateUserSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = userSettingsSchema.safeParse({
    theme: formData.get("theme"),
    hideMoneyInsights: bool(formData.get("hideMoneyInsights")),
    hidePartnerPreferenceGap: bool(formData.get("hidePartnerPreferenceGap")),
  });
  if (!parsed.success) {
    return errorState("Those settings didn't save.", toFieldErrors(parsed.error));
  }
  try {
    await updateUserSettings(user.id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/settings");
  revalidatePath("/couple");
  revalidatePath("/", "layout");
  return successState(undefined, "Settings saved.");
}

/** Fast path for the theme switcher — persists the choice; the client also updates the DOM. */
export async function setThemeAction(
  _prev: ActionState<{ theme: Theme }>,
  formData: FormData,
): Promise<ActionState<{ theme: Theme }>> {
  const user = await requireUser();
  const parsed = themeSchema.safeParse({ theme: formData.get("theme") });
  if (!parsed.success) return errorState("Unknown theme.");
  try {
    await setUserTheme(user.id, parsed.data.theme);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  return successState({ theme: parsed.data.theme }, "Theme updated.");
}

/**
 * Archive the shared space and release both people. Destructive — the caller confirms first.
 * Nothing is hard-deleted.
 */
export async function disconnectPartnerAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { couple } = await requireCoupleContext();
  try {
    await disconnectCouple(couple.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState('Type "DELETE" to confirm.', toFieldErrors(parsed.error));
  }
  try {
    await deleteAccount(user.id);
  } catch (error) {
    return toActionError(error);
  }
  await clearSessionCookie();
  redirect("/login");
}
