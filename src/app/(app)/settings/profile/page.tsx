import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { requireOnboarded } from "@/lib/onboarding";
import { getProfile } from "@/server/services/profile-service";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfileSettingsPage() {
  const { user } = await requireOnboarded();
  const profile = await getProfile(user.id);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Your profile"
        description="How you show up in your shared space."
        back={{ href: "/couple", label: "Couple" }}
      />
      <ProfileForm
        initial={{
          name: profile.name,
          nickname: profile.nickname,
          pronouns: profile.pronouns,
          birthday: profile.birthday ? profile.birthday.toISOString().slice(0, 10) : null,
          avatarUrl: profile.avatarUrl,
        }}
      />
    </div>
  );
}
