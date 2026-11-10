"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailSchema } from "@/lib/validation/common";
import { MINUTE, checkRateLimit } from "@/lib/security/rate-limit";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { beginEmailVerification, completeEmailVerification } from "@/server/services/email-verification-service";
import { toActionError } from "./_helpers";

export async function requestVerificationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const limited = await checkRateLimit("email-verification-request", 4, 60 * MINUTE);
  if (limited) return errorState(limited);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return errorState("Enter a valid email address.", { email: ["Enter a valid email address."] });
  try { await beginEmailVerification(email.data); }
  catch { console.error("[email] Verification delivery failed; check email configuration."); }
  return successState(undefined, "If that account needs confirmation, a verification email is on its way. Allow a minute before requesting another.");
}

export async function verifyEmailAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const limited = await checkRateLimit("email-verification-confirm", 20, 15 * MINUTE);
  if (limited) return errorState(limited);
  const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(form.get("token"));
  if (!token.success) return errorState("This verification link is invalid. Request a new one below.");
  try {
    await completeEmailVerification(token.data);
    revalidatePath("/", "layout");
    return successState(undefined, "Your email address is confirmed. Thank you for making this space yours.");
  } catch (error) { return toActionError(error); }
}
