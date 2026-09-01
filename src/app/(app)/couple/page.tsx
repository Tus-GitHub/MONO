import type { Metadata } from "next";
import Link from "next/link";
import { CoupleStatus } from "@prisma/client";

import { InviteCodeCard } from "@/components/couple/invite-code-card";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { Icon } from "@/components/ui/icon";
import { requireCoupleOrOnboard } from "@/lib/authz";
import { getCoupleOverview } from "@/server/services/couple-service";
import { logoutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Couple" };

function formatDate(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(value);
}

export default async function CouplePage() {
  const { couple } = await requireCoupleOrOnboard();
  const overview = await getCoupleOverview(couple.id);
  const anniversary = formatDate(couple.anniversaryAt);

  return (
    <div className="space-y-6">
      <PageHeader title="Couple" description="Your shared space and who's in it." />

      <Card>
        <div className="flex items-center gap-4">
          <CoupleAvatar
            members={overview.members.map((m) => ({ name: m.name, src: m.avatarUrl }))}
            size="lg"
          />
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-medium text-ink">
              {couple.name ?? "Your space"}
            </h2>
            <div className="mt-1">
              <Badge tone={couple.status === CoupleStatus.ACTIVE ? "success" : "warning"} dot>
                {couple.status === CoupleStatus.ACTIVE ? "Connected" : "Waiting for partner"}
              </Badge>
            </div>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Anniversary</dt>
            <dd className="mt-0.5 text-ink">{anniversary ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-muted">Currency</dt>
            <dd className="mt-0.5 text-ink">{couple.currency}</dd>
          </div>
        </dl>
      </Card>

      {couple.status === CoupleStatus.PENDING ? (
        <InviteCodeCard code={couple.inviteCode} />
      ) : null}

      <Card>
        <CardHeader title="Members" description={`${overview.members.length} of 2`} />
        <ul className="divide-y divide-line">
          {overview.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar name={member.name} src={member.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{member.name}</span>
              <span className="text-xs uppercase tracking-wide text-faint">{member.role}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader icon={<Icon name="settings" size="sm" />} title="Settings" />
        <div className="divide-y divide-line">
          <SettingsLink href="/settings/profile" label="Your profile" />
          <SettingsLink href="/settings/notifications" label="Reminders" />
        </div>
        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-surface"
          >
            <Icon name="logout" size="sm" className="text-muted" />
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-3 text-sm text-ink transition-colors first:pt-0 last:pb-0 hover:text-primary"
    >
      {label}
      <Icon name="chevronRight" size="sm" className="text-faint" />
    </Link>
  );
}
