"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { authorizeDate } from "@/lib/authz";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/prefs";
import { errorState, successState, type ActionState } from "@/lib/utils/result";
import { zonedTimeToUtc } from "@/lib/utils/timezone";
import { idSchema } from "@/lib/validation/common";
import {
  setPushSubscription,
  updateNotificationPrefs,
} from "@/server/services/notification-preference-service";
import {
  clearCustomReminder,
  dismissReminder,
  dispatchDueReminders,
  setCustomReminder,
  snoozeReminder,
} from "@/server/services/reminder-service";
import { toActionError } from "@/server/actions/_helpers";

const bool = (value: FormDataEntryValue | null) => value === "on" || value === "true";

const prefKeys = NOTIFICATION_CATEGORIES;

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

/**
 * Deliver any reminders that have come due for the signed-in user. Called on a gentle client
 * timer so reminders aren't stuck until someone happens to open Home. Idempotent, cheap, and
 * safe to call often — `dispatchDueReminders` de-dupes and only writes when something is due.
 */
export async function dispatchMyRemindersAction(): Promise<{ delivered: number }> {
  try {
    const user = await requireUser();
    const delivered = await dispatchDueReminders(user.id);
    if (delivered > 0) revalidatePath("/", "layout");
    return { delivered };
  } catch {
    return { delivered: 0 };
  }
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
  revalidatePath("/notifications");
  return successState(undefined, "Dismissed.");
}

export async function snoozeReminderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  try {
    await snoozeReminder(id, user.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath("/notifications");
  return successState(undefined, "We'll remind you tomorrow.");
}

// `at` is the raw <input type="datetime-local"> value: "YYYY-MM-DDTHH:mm" (no offset).
const customReminderSchema = z.object({
  dateId: idSchema,
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time."),
});

export async function setCustomReminderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = customReminderSchema.safeParse({
    dateId: formData.get("dateId"),
    at: formData.get("at"),
  });
  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Check the reminder time.");
  }
  try {
    // couple-scope the date, then read its timezone so the wall-clock time means what the user meant
    const { context, resource } = await authorizeDate(parsed.data.dateId);
    const [ymd, hm] = parsed.data.at.split("T");
    const [hh, mm] = hm.split(":").map(Number);
    const at = zonedTimeToUtc(ymd, hh, mm, context.couple.timezone);
    if (at.getTime() <= Date.now()) return errorState("Pick a time in the future.");
    await setCustomReminder(resource.id, user.id, at);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${parsed.data.dateId}`);
  return successState(undefined, "Reminder set.");
}

export async function clearCustomReminderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const dateId = idSchema.parse(formData.get("dateId"));
  try {
    const { resource } = await authorizeDate(dateId);
    await clearCustomReminder(resource.id, user.id);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/dates/${dateId}`);
  return successState(undefined, "Reminder cleared.");
}
