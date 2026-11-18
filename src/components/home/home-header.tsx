import Link from "@/components/ui/app-link";

import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { CouplePhoto } from "@/components/ui/couple-photo";
import { Icon } from "@/components/ui/icon";
import { formatDate, possessiveNames } from "@/lib/utils/format";

interface Person {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
}

function greetingFor(timezone: string): string {
  let hour = 12;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    );
  } catch {
    hour = new Date().getHours();
  }
  if (Number.isNaN(hour)) hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning, you two.";
  if (hour >= 12 && hour < 17) return "Good afternoon, you two.";
  if (hour >= 17 && hour < 22) return "Good evening, you two.";
  return "Still up, you two?";
}

export function HomeHeader({
  members,
  couplePhotoUrl,
  timezone,
  subline,
}: {
  members: Person[];
  couplePhotoUrl: string | null;
  timezone: string;
  subline: string;
}) {
  const names = possessiveNames(members.map((member) => member.nickname || member.name));

  return (
    <header className="relative overflow-hidden rounded-2xl border border-line bg-linear-to-br from-primary-tint/45 via-surface to-accent-tint/35 p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/couple"
          className="inline-flex min-w-0 max-w-full items-center gap-3 rounded-xl bg-surface/80 py-1.5 pl-2 pr-3 shadow-xs ring-1 ring-line/80 backdrop-blur-xs transition-colors hover:bg-surface"
        >
          {couplePhotoUrl ? (
            <CouplePhoto
              src={couplePhotoUrl}
              className="h-9 shrink-0 rounded-lg ring-2 ring-surface"
              priority
            />
          ) : (
            <CoupleAvatar
              members={members.map((member) => ({ name: member.name, src: member.avatarUrl }))}
              size="sm"
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{names}</span>
            <span className="block text-xs text-muted">{formatDate(new Date(), "full")}</span>
          </span>
          <Icon name="chevronRight" size="sm" className="shrink-0 text-faint" />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/plan/new"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg shadow-xs transition-colors hover:bg-primary-hover"
          >
            <Icon name="plus" size="xs" />
            Plan a date
          </Link>
          <Link
            href="/chat"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface/85 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface"
          >
            <Icon name="message" size="xs" className="text-primary" />
            Chat
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
          {greetingFor(timezone)}
        </h1>
        <p className="mt-1 text-sm text-muted">{subline}</p>
      </div>
    </header>
  );
}
