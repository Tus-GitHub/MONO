import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { Icon } from "@/components/ui/icon";
import { formatDate, possessiveNames } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

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
  me,
  couplePhotoUrl,
  timezone,
  unreadNotifications,
  subline,
}: {
  members: Person[];
  me: { name: string; avatarUrl: string | null };
  couplePhotoUrl: string | null;
  timezone: string;
  unreadNotifications: number;
  subline: string;
}) {
  const names = possessiveNames(members.map((member) => member.nickname || member.name));

  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/couple"
          className="flex min-w-0 items-center gap-3 rounded-lg py-1 pr-2 transition-colors hover:bg-ink/[0.04]"
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
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/notifications"
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} unread`
                : "Notifications"
            }
            className="tap relative grid place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <Icon name="bell" size="md" />
            {unreadNotifications > 0 ? (
              <span
                className={cn(
                  "absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[0.6rem] font-semibold leading-4 text-primary-fg",
                )}
              >
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            ) : null}
          </Link>
          <Link
            href="/settings/profile"
            aria-label="Your profile"
            className="tap grid place-items-center rounded-lg"
          >
            <Avatar name={me.name} src={me.avatarUrl} size="sm" />
          </Link>
        </div>
      </div>

      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
          {greetingFor(timezone)}
        </h1>
        <p className="mt-1 text-sm text-muted">{subline}</p>
      </div>
    </header>
  );
}
