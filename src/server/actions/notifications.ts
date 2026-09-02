"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { idSchema } from "@/lib/validation/common";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/services/notification-service";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/home");
}

/** Fired when a notification row is opened — best-effort, never blocks navigation. */
export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;
  await markNotificationRead(parsed.data, user.id);
  revalidatePath("/notifications");
  revalidatePath("/home");
}
