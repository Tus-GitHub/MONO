import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { Icon } from "@/components/ui/icon";

interface NavPerson {
  name: string;
  avatarUrl?: string | null;
}

/** Compact top bar for phones and tablets. On desktop the sidebar carries navigation. */
export function TopBar({ members }: { members: NavPerson[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/85 px-4 pt-safe backdrop-blur-md lg:hidden">
      <Logo href="/home" size="sm" />
      <div className="flex items-center gap-1">
        <Link
          href="/explore"
          aria-label="Explore"
          className="tap grid place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
        >
          <Icon name="search" size="sm" />
        </Link>
        <Link
          href="/couple"
          aria-label="Couple space"
          className="tap grid place-items-center rounded-lg"
        >
          <CoupleAvatar members={members} size="sm" />
        </Link>
      </div>
    </header>
  );
}
