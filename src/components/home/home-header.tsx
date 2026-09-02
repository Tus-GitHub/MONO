import Link from "next/link";

import { CoupleAvatar } from "@/components/ui/couple-avatar";
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
    <header className="space-y-4">
      <Link
        href="/couple"
        className="inline-flex min-w-0 items-center gap-3 rounded-lg py-1 pr-2 transition-colors hover:bg-ink/[0.04]"
      >
        {couplePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={couplePhotoUrl}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover ring-2 ring-surface"
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

      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
          {greetingFor(timezone)}
        </h1>
        <p className="mt-1 text-sm text-muted">{subline}</p>
      </div>
    </header>
  );
}
