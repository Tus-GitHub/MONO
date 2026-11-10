import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ArchiveDownload } from "@/components/settings/archive-download";
import { ArchiveRestore } from "@/components/settings/archive-restore";
import { requireOnboarded } from "@/lib/onboarding";
import { getArchiveRestoreSettings } from "@/server/services/archive-service";

export const metadata: Metadata = { title: "Archive & restore" };

export default async function ArchiveSettingsPage() {
  await requireOnboarded();
  const settings = await getArchiveRestoreSettings();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Archive & restore" description="Keep a portable copy of your shared history."
        back={{ href: "/settings", label: "Settings" }} />
      <ArchiveDownload />
      <ArchiveRestore {...settings} />
    </div>
  );
}
