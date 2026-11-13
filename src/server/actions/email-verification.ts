"use server";

import { emailSchema } from "@/lib/validation/common";
import { MINUTE, checkRateLimit } from "@/lib/security/rate-limit";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { beginEmailVerification } from "@/server/services/email-verification-service";
import { requireUser } from "@/lib/auth/current-user";

export async function resendOwnVerificationAction(_previous: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const form = new FormData();
  form.set("email", user.email);
  return requestVerificationAction(_previous, form);
}
export async function requestVerificationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const limited = await checkRateLimit("email-verification-request", 4, 60 * MINUTE);
  if (limited) return errorState(limited);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return errorState("Enter a valid email address.", { email: ["Enter a valid email address."] });
  try { await beginEmailVerification(email.data); }
  catch { console.error("[email] Verification delivery failed; check email configuration."); }
  return successState(undefined, "If that account needs confirmation, a verification email is on its way. Allow a minute before requesting another.");
}
