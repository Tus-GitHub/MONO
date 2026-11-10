import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";
import { requireOnboarded } from "@/lib/onboarding";
import { getPasswordSettings } from "@/server/services/session-service";

export const metadata: Metadata = { title: "Change password" };

export default async function PasswordSettingsPage() {
  await requireOnboarded();
  const { hasPassword } = await getPasswordSettings();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Change password" description="Keep your account yours."
        back={{ href: "/settings", label: "Settings" }} />
      <PasswordSettingsForm hasPassword={hasPassword} />
    </div>
  );
}
