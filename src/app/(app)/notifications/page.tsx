import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import {
  NotificationsList,
  type NotificationRow,
} from "@/components/notifications/notifications-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { requireOnboarded } from "@/lib/onboarding";
import { markAllNotificationsReadAction } from "@/server/actions/notifications";
import { listNotifications } from "@/server/services/notification-service";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user } = await requireOnboarded();
  const rows = await listNotifications(user.id);
  const hasUnread = rows.some((n) => n.readAt == null);

  const items: NotificationRow[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entityType,
    entityId: n.entityId,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Notifications"
        description="Reminders and updates from your shared space."
        action={
          <div className="flex items-center gap-2">
            <LinkButton href="/settings/notifications" variant="ghost" size="sm">
              Settings
            </LinkButton>
            {hasUnread ? (
              <form action={markAllNotificationsReadAction}>
                <Button type="submit" variant="secondary" size="sm">
                  Mark all read
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon name="bell" size="md" />}
          title="You're all caught up."
          description="A nudge before a date, a note when your partner adds something — it'll show up here."
          action={
            <LinkButton href="/settings/notifications" variant="secondary" size="sm">
              Choose what MONO tells you
            </LinkButton>
          }
        />
      ) : (
        <NotificationsList items={items} />
      )}
    </PageContainer>
  );
}
