/**
 * The per-user notification categories. Pure — shared by the preference service, the settings
 * form, the notification fan-out, and the reminder dispatcher so a category is gated the same
 * way everywhere.
 */

export const NOTIFICATION_CATEGORIES = [
  "upcomingDate",
  "dateDay",
  "reviewReminder",
  "memoryReminder",
  "unfinishedPlan",
  "partnerEdits",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const DEFAULT_CATEGORY_PREFS: Record<NotificationCategory, boolean> = {
  upcomingDate: true,
  dateDay: true,
  reviewReminder: true,
  memoryReminder: true,
  unfinishedPlan: true,
  partnerEdits: true,
};

export const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; hint: string }
> = {
  upcomingDate: { label: "Upcoming date", hint: "The day before a planned date." },
  dateDay: { label: "Date day", hint: "On the morning of the date." },
  reviewReminder: { label: "Review reminders", hint: "When a finished date still needs your review." },
  memoryReminder: { label: "Memory reminders", hint: "When a finished date has no memory yet." },
  unfinishedPlan: { label: "Unfinished plan", hint: "A draft you started but didn't finish." },
  partnerEdits: { label: "Partner activity", hint: "When your partner changes or adds to a shared date." },
};
