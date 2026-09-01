"use server";

import { redirect } from "next/navigation";

import { clearSessionCookie, writeSessionCookie } from "@/lib/auth/session-cookie";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/common";
import {
  authenticate,
  beginPasswordReset,
  completePasswordReset,
  registerUser,
} from "@/server/services/auth-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

const GENERIC_RESET_MESSAGE = "If that email has an account, a reset link is on its way.";

/** Where to send someone after they authenticate — an invite link if they came from one. */
function postAuthDestination(formData: FormData): string {
  const invite = formData.get("invite");
  if (typeof invite === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(invite)) {
    return `/invite/${invite}`;
  }
  return "/onboarding";
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    const user = await registerUser(parsed.data);
    await writeSessionCookie({ userId: user.id, tokenVersion: user.tokenVersion });
  } catch (error) {
    return toActionError(error);
  }

  redirect(postAuthDestination(formData));
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const remember = formData.get("remember") != null;

  try {
    const user = await authenticate(parsed.data);
    await writeSessionCookie({ userId: user.id, tokenVersion: user.tokenVersion }, remember);
  } catch (error) {
    return toActionError(error);
  }

  redirect(postAuthDestination(formData));
}

export async function logoutAction(_formData?: FormData): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestPasswordResetSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Enter a valid email address.", toFieldErrors(parsed.error));
  }

  try {
    await beginPasswordReset(parsed.data.email);
  } catch (error) {
    return toActionError(error);
  }

  return successState(undefined, GENERIC_RESET_MESSAGE);
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    await completePasswordReset(parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  redirect("/login?reset=1");
}
