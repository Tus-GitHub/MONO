import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { DangerZone } from "@/components/settings/danger-zone";
import { DataExportCard } from "@/components/settings/data-export-card";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { InstallPrompt } from "@/components/system/install-prompt";
import { Icon } from "@/components/ui/icon";
import { requireCoupleOrOnboard } from "@/lib/authz";
import { getCoupleMembersLite } from "@/server/services/couple-service";
import { getUserSettings } from "@/server/services/user-settings-service";
import { logoutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, couple } = await requireCoupleOrOnboard();
  const [settings, members] = await Promise.all([
    getUserSettings(user.id),
    getCoupleMembersLite(couple.id),
  ]);
  const partner = members.find((m) => m.id !== user.id) ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        title="Settings"
        description="Profiles, privacy, appearance and your account."
        back={{ href: "/couple", label: "Couple" }}
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Profiles</h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <Row href="/settings/couple" label="Couple profile" hint="Name, photo, relationship date, currency" />
          <Row href="/settings/profile" label="Personal profile" hint="Your name, nickname, pronouns, photo" />
          <Row href="/settings/notifications" label="Reminders & notifications" hint="What MONO nudges you about, and how" />
          <Row href="/settings/privacy" label="Privacy" hint="What's private, what we collect, and what we don't" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Preferences</h2>
        <PreferencesForm initial={settings} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Data</h2>
        <DataExportCard />
      </section>

      {/* Renders only when MONO is installable and not already installed. */}
      <InstallPrompt variant="card" />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-ink">Session</h2>
        <form
          action={logoutAction}
          className="rounded-xl border border-line bg-surface p-5"
        >
          <p className="text-sm font-medium text-ink">Sign out</p>
          <p className="mt-1 text-sm text-muted">Sign out on this device.</p>
          <button
            type="submit"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink transition-colors hover:bg-paper"
          >
            <Icon name="logout" size="sm" className="text-muted" />
            Sign out
          </button>
        </form>
      </section>

      <DangerZone hasPartner={partner != null} partnerName={partner?.name ?? null} />
    </div>
  );
}

function Row({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper/70"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
      <Icon name="chevronRight" size="sm" className="shrink-0 text-faint" />
    </Link>
  );
}
