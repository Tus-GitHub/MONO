"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { Icon } from "@/components/ui/icon";
import { isActive, NAV_ITEMS } from "@/lib/navigation/nav";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils/cn";

interface NavPerson {
  name: string;
  avatarUrl?: string | null;
}

interface SidebarProps {
  coupleName: string | null;
  members: NavPerson[];
}

/** Desktop navigation rail. Hidden below `lg` (bottom nav takes over). */
export function Sidebar({ coupleName, members }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) flex-col border-r border-line bg-surface lg:flex">
      <div className="px-5 py-5">
        <Logo href="/home" />
      </div>

      <div className="px-4">
        <PlanDateButton fullWidth />
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-tint text-primary"
                  : "text-muted hover:bg-ink/[0.04] hover:text-ink",
              )}
            >
              <Icon
                name={item.icon}
                size="md"
                className={cn(active ? "text-primary" : "text-faint group-hover:text-muted")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/couple"
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-ink/[0.04]"
        >
          <CoupleAvatar members={members} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {coupleName ?? "Your space"}
            </span>
            <span className="block text-xs text-muted">
              {members.length === 2 ? "Connected" : "Waiting for partner"}
            </span>
          </span>
          <Icon name="chevronRight" size="sm" className="text-faint" />
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            <Icon name="logout" size="sm" className="text-faint" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
