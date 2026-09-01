"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { idSchema } from "@/lib/validation/common";
import {
  setPushSubscription,
  updateNotificationPrefs,
} from "@/server/services/notification-preference-service";
import { dismissReminder } from "@/server/services/reminder-service";
import { toActionError } from "@/server/actions/_helpers";

const bool = (value: FormDataEntryValue | null) => value === "on" || value === "true";

const prefKeys = [
  "upcomingDate",
  "dateDay",
  "reviewReminder",
  "unfinishedPlan",
  "partnerEdits",
] as const;

export async function updateNotificationPrefsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const patch = Object.fromEntries(
    prefKeys.map((key) => [key, bool(formData.get(key))]),
  ) as Record<(typeof prefKeys)[number], boolean>;

  try {
    await updateNotificationPrefs(user.id, patch);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/settings/notifications");
  return successState(undefined, "Preferences saved.");
}

const subscriptionSchema = z
  .object({ endpoint: z.string().url() })
  .passthrough()
  .nullable();

export async function savePushSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const raw = formData.get("subscription");
  let parsed: z.infer<typeof subscriptionSchema>;
  try {
    parsed = subscriptionSchema.parse(raw === "null" || raw == null ? null : JSON.parse(String(raw)));
  } catch {
    return errorState("That subscription looks malformed.");
  }
  try {
    await setPushSubscription(user.id, parsed);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/settings/notifications");
  return successState(undefined, parsed ? "Browser notifications on." : "Browser notifications off.");
}

export async function dismissReminderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  try {
    await dismissReminder(id, user.id);
  } catch (error) {
    return toActionError(error);
  }
  return successState(undefined, "Dismissed.");
}
