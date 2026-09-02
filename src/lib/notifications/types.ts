import type { NotificationType, ReminderKind } from "@prisma/client";

import type { IconName } from "@/components/ui/icon";
import type { NotificationCategory } from "@/lib/notifications/prefs";

export const NOTIFICATION_ICON: Record<NotificationType, IconName> = {
  DATE_REMINDER: "clock",
  DATE_PLANNED: "calendarPlus",
  DATE_STATUS_CHANGED: "calendar",
  DATE_EDITED: "pencil",
  DATE_NEEDS_ACTION: "alertCircle",
  REVIEW_ADDED: "star",
  REVIEW_REMINDER: "star",
  MEMORY_ADDED: "images",
  MEMORY_REMINDER: "images",
  EXPENSE_ADDED: "wallet",
  PARTNER_JOINED: "users",
  SYSTEM: "info",
};

/**
 * Which preference category gates a notification type. `null` = always delivered (joins,
 * system messages, a date's own status changes). A ruled-out category is never sent.
 */
export const NOTIFICATION_CATEGORY_OF: Record<NotificationType, NotificationCategory | null> = {
  DATE_REMINDER: null, // the reminder itself is already category-gated at schedule time
  DATE_PLANNED: null,
  DATE_STATUS_CHANGED: null,
  DATE_EDITED: "partnerEdits",
  DATE_NEEDS_ACTION: null,
  REVIEW_ADDED: "reviewReminder",
  REVIEW_REMINDER: "reviewReminder",
  MEMORY_ADDED: "partnerEdits",
  MEMORY_REMINDER: "memoryReminder",
  EXPENSE_ADDED: "partnerEdits",
  PARTNER_JOINED: null,
  SYSTEM: null,
};

/** Which preference category gates a scheduled reminder. `null` = user opted in explicitly. */
export const REMINDER_CATEGORY_OF: Record<ReminderKind, NotificationCategory | null> = {
  UPCOMING: "upcomingDate",
  DATE_DAY: "dateDay",
  CUSTOM: null, // the user set it by hand for this date
  REVIEW: "reviewReminder",
  MEMORY: "memoryReminder",
  UNFINISHED_PLAN: "unfinishedPlan",
};

/** Where a notification points when tapped. */
export function notificationHref(n: {
  type: NotificationType;
  entityType: string | null;
  entityId: string | null;
  data?: unknown;
}): string {
  const dateId = n.entityType === "Date" ? n.entityId : null;
  if (dateId) {
    switch (n.type) {
      case "MEMORY_REMINDER":
        return `/dates/${dateId}/memory`;
      case "REVIEW_REMINDER":
        return `/dates/${dateId}/review`;
      case "REVIEW_ADDED":
        return `/dates/${dateId}#review`;
      case "MEMORY_ADDED":
        return `/dates/${dateId}#memory`;
      case "EXPENSE_ADDED":
        return `/dates/${dateId}#spending`;
      default:
        return `/dates/${dateId}`;
    }
  }
  if (n.type === "PARTNER_JOINED") return "/couple";
  return "/notifications";
}
