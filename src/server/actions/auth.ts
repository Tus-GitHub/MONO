"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

import { clearSessionCookie, writeSessionCookie } from "@/lib/auth/session-cookie";
import { MINUTE, checkRateLimit } from "@/lib/security/rate-limit";
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
import { revokeCurrentAuthSession } from "@/server/services/session-service";
import { sendRegistrationEmails } from "@/server/services/email-verification-service";
import { rememberInvitation, clearPendingInvitation, validInvitationToken } from "@/lib/auth/pending-invitation";

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
  const limited = await checkRateLimit("register", 5, 15 * MINUTE);
  if (limited) return errorState(limited);

  const parsed = registerSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    const user = await registerUser(parsed.data);
    await writeSessionCookie({ userId: user.id, tokenVersion: user.tokenVersion });
    const invite = formData.get("invite");
    if (validInvitationToken(invite)) await rememberInvitation(user.id, invite);
    after(async () => {
      try { await sendRegistrationEmails(user.id); }
      catch { console.error("[email] Registration email delivery failed; account remains available."); }
    });
  } catch (error) {
    return toActionError(error);
  }

  redirect(postAuthDestination(formData));
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("login", 10, 15 * MINUTE);
  if (limited) return errorState(limited);

  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const remember = formData.get("remember") != null;

  try {
    const user = await authenticate(parsed.data);
    await writeSessionCookie({ userId: user.id, tokenVersion: user.tokenVersion }, remember);
    const invite = formData.get("invite");
    if (validInvitationToken(invite)) await rememberInvitation(user.id, invite);
  } catch (error) {
    return toActionError(error);
  }

  redirect(postAuthDestination(formData));
}

export async function logoutAction(_formData?: FormData): Promise<void> {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get("mono_push_device")?.value;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try { user = await getCurrentUser(); }
  catch { console.error("[logout] current user unavailable"); }
  try { await revokeCurrentAuthSession(); }
  catch { console.error("[logout] session revocation unavailable"); }
  try {
    if (user) await prisma.pushSubscription.deleteMany({ where: {
      userId: user.id, id: deviceId ?? { startsWith: "legacy_" },
    } });
  } catch { console.error("[logout] push device unlink unavailable"); }
  cookieStore.delete("mono_push_device");
  await clearPendingInvitation();
  await clearSessionCookie();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("password-reset-request", 4, 60 * MINUTE);
  if (limited) return errorState(limited);

  const parsed = requestPasswordResetSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Enter a valid email address.", toFieldErrors(parsed.error));
  }

  try {
    await beginPasswordReset(parsed.data.email);
  } catch {
    // Keep the same response for unknown accounts and mail outages. Never log reset URLs.
    console.error("[auth] Password reset delivery failed; check email configuration.");
  }

  return successState(undefined, GENERIC_RESET_MESSAGE);
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limited = await checkRateLimit("password-reset", 10, 15 * MINUTE);
  if (limited) return errorState(limited);

  const parsed = resetPasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    await completePasswordReset(parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  await clearSessionCookie();
  redirect("/login?reset=1");
}
