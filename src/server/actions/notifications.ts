"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { markAllNotificationsRead } from "@/server/services/notification-service";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/home");
}
