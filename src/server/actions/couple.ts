"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { requireCoupleContext } from "@/lib/authz";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema, toFieldErrors } from "@/lib/validation/common";
import {
  acceptInvitationSchema,
  coupleSetupSchema,
  createCoupleSchema,
  createInvitationSchema,
  joinCoupleSchema,
} from "@/lib/validation/couple";
import {
  createCoupleForUser,
  joinCoupleByInviteCode,
  markCoupleSetupComplete,
  updateCoupleSetup,
} from "@/server/services/couple-service";
import {
  acceptInvitation,
  createInvitation,
  revokeInvitation,
} from "@/server/services/invitation-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

export async function createCoupleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createCoupleSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  try {
    await createCoupleForUser(user.id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function joinCoupleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = joinCoupleSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Enter the invite code your partner shared.", toFieldErrors(parsed.error));
  }
  try {
    await joinCoupleByInviteCode(user.id, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

/** Onboarding step 3: save the couple space and mark setup done. */
export async function completeCoupleSetupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { couple } = await requireCoupleContext();
  const parsed = coupleSetupSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }
  try {
    await updateCoupleSetup(couple.id, parsed.data);
    await markCoupleSetupComplete(couple.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding/done");
}

/** Issue a fresh shareable invitation link; returns the URL for the client to copy/share. */
export async function generateInvitationAction(
  _prev: ActionState<{ url: string; expiresAt: string }>,
  formData: FormData,
): Promise<ActionState<{ url: string; expiresAt: string }>> {
  const { user, couple } = await requireCoupleContext();
  const parsed = createInvitationSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Enter a valid email, or leave it blank.", toFieldErrors(parsed.error));
  }
  try {
    const { url, invitation } = await createInvitation(couple.id, user.id, {
      email: parsed.data.email,
    });
    revalidatePath("/onboarding/connect");
    return successState(
      { url, expiresAt: invitation.expiresAt.toISOString() },
      "Invitation link ready.",
    );
  } catch (error) {
    return toActionError(error);
  }
}

export async function revokeInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { couple } = await requireCoupleContext();
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return errorState("Missing invitation.");
  try {
    await revokeInvitation(parsed.data, couple.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/onboarding/connect");
  return successState(undefined, "Invitation cancelled.");
}

export async function acceptInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = acceptInvitationSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("That invitation link is not valid.", toFieldErrors(parsed.error));
  }
  try {
    await acceptInvitation(parsed.data.token, user.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
