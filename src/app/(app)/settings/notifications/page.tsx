import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { EnableBrowserNotifications } from "@/components/settings/enable-browser-notifications";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { requireOnboarded } from "@/lib/onboarding";
import { getNotificationPrefs } from "@/server/services/notification-preference-service";

export const metadata: Metadata = { title: "Reminders" };

export default async function NotificationSettingsPage() {
  const { user } = await requireOnboarded();
  const prefs = await getNotificationPrefs(user.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Reminders"
        description="What MONO reminds you about, and how."
        back={{ href: "/couple", label: "Couple" }}
      />
      <EnableBrowserNotifications />
      <NotificationSettingsForm initial={prefs} />
    </div>
  );
}
