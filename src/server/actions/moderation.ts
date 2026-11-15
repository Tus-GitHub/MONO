"use server";

import { revalidatePath } from "next/cache";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { checkRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { formValues, toActionError } from "@/server/actions/_helpers";
import { moderateAccount, reviewAccountReport, submitAccountReport } from "@/server/services/moderation-service";

export async function moderateAccountAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try { await moderateAccount(formValues(form)); }
  catch (error) { return toActionError(error); }
  revalidatePath("/admin");
  return successState(undefined, "Account action recorded.");
}

export async function reviewReportAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try { await reviewAccountReport(formValues(form)); }
  catch (error) { return toActionError(error); }
  revalidatePath("/admin");
  return successState(undefined, "Review saved.");
}

export async function submitReportAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const limited = await checkRateLimit("account-report", 10, 60 * MINUTE);
  if (limited) return errorState(limited);
  try { await submitAccountReport(formValues(form)); }
  catch (error) { return toActionError(error); }
  revalidatePath("/admin");
  return successState(undefined, "Your report has been sent for manual review.");
}
