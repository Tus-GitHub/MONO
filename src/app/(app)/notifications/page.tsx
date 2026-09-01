import type { Metadata } from "next";
import { NotificationType } from "@prisma/client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { requireOnboarded } from "@/lib/onboarding";
import { relativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { markAllNotificationsReadAction } from "@/server/actions/notifications";
import { listNotifications } from "@/server/services/notification-service";

export const metadata: Metadata = { title: "Notifications" };

const ICON: Record<NotificationType, IconName> = {
  DATE_REMINDER: "clock",
  DATE_PLANNED: "calendarPlus",
  DATE_STATUS_CHANGED: "calendar",
  DATE_EDITED: "pencil",
  REVIEW_ADDED: "star",
  MEMORY_ADDED: "images",
  EXPENSE_ADDED: "wallet",
  PARTNER_JOINED: "users",
  SYSTEM: "info",
};

export default async function NotificationsPage() {
  const { user } = await requireOnboarded();
  const notifications = await listNotifications(user.id);
  const hasUnread = notifications.some((notification) => notification.readAt == null);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Reminders and updates from your shared space."
        action={
          hasUnread ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary" size="sm">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Icon name="info" size="md" />}
          title="Nothing here yet"
          description="When a date is coming up or your partner adds something, you'll see it here."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={cn(
                "flex gap-3 px-4 py-3.5",
                notification.readAt == null && "bg-primary-tint/30",
              )}
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
                <Icon name={ICON[notification.type]} size="sm" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{notification.title}</p>
                {notification.body ? (
                  <p className="mt-0.5 text-sm text-muted">{notification.body}</p>
                ) : null}
                <p className="mt-1 text-2xs text-faint">{relativeTime(notification.createdAt)}</p>
              </div>
              {notification.readAt == null ? (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
