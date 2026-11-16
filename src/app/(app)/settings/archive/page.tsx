import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="space-y-2 rounded-xl border border-line bg-surface p-5"><h2 className="font-display text-xl">Past shared spaces</h2><p className="text-sm text-muted">If a former partner deleted their account, ask admin for read-only access to that archived space.</p><Link href="/history-access" className="inline-block text-sm text-primary underline">Your archived spaces</Link></div>
    </div>
  );
}
