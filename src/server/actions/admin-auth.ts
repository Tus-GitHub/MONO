"use server";

import { redirect } from "next/navigation";
import { writeSessionCookie } from "@/lib/auth/session-cookie";
import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { errorState, type ActionState } from "@/lib/utils/result";
import { authenticateAdmin } from "@/server/services/admin-auth-service";
import { formValues, toActionError } from "@/server/actions/_helpers";

export async function adminLoginAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const limited = await checkRateLimit("admin-login", 5, 15 * MINUTE);
  if (limited) return errorState(limited);
  try {
    const user = await authenticateAdmin(formValues(form));
    await writeSessionCookie({ userId: user.id, tokenVersion: user.tokenVersion }, false);
  } catch (error) { return toActionError(error); }
  redirect("/admin");
}
