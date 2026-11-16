"use server";
import { revalidatePath } from "next/cache";
import { successState, type ActionState } from "@/lib/utils/result";
import { formValues, toActionError } from "./_helpers";
import { requestArchivedAccess, reviewArchiveAccess } from "@/server/services/archive-access-service";

export async function requestArchiveAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try { await requestArchivedAccess(form.get("coupleId")); }
  catch (error) { return toActionError(error); }
  revalidatePath("/history-access"); revalidatePath("/admin");
  return successState(undefined, "Request sent to admin. Your history stays locked until approval.");
}
export async function reviewArchiveAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try { await reviewArchiveAccess(formValues(form)); }
  catch (error) { return toActionError(error); }
  revalidatePath("/admin"); revalidatePath("/history-access", "layout");
  return successState(undefined, "Access decision saved.");
}
