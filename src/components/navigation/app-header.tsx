"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Logo } from "@/components/layout/logo";
import { focusRing } from "@/components/ui/_shared";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useEscapeKey } from "@/components/ui/_dialog-primitives";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils/cn";

interface AppHeaderProps {
  user: { name: string; avatarUrl?: string | null };
  unreadCount: number;
}

/**
 * The persistent authenticated header. It carries the notification and account controls on
 * every page so they never live on one screen only. Compact bar on mobile (logo + actions);
 * a slim right-aligned strip inside the content column on desktop, where the sidebar owns
 * primary navigation.
 */
export function AppHeader({ user, unreadCount }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-(--appheader-h) items-center gap-2 border-b border-line bg-paper/85 pt-safe backdrop-blur-md",
        "px-4 sm:px-6 lg:justify-end lg:border-b-0 lg:bg-transparent lg:px-8 lg:backdrop-blur-none",
      )}
    >
      <div className="mr-auto lg:hidden">
        <Logo href="/home" size="sm" />
      </div>

      {/* Explore is a primary destination but not a bottom-nav tab — keep it one tap away on mobile. */}
      <Link
        href="/explore"
        aria-label="Explore"
        className={cn(
          "tap grid place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink lg:hidden",
          focusRing,
        )}
      >
        <Icon name="compass" size="md" />
      </Link>

      <NotificationsBell unreadCount={unreadCount} />
      <AccountMenu user={user} />
    </header>
  );
}

function NotificationsBell({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const active = pathname === "/notifications";
  const label =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap relative grid place-items-center rounded-lg transition-colors",
        focusRing,
        active ? "text-primary" : "text-muted hover:bg-ink/[0.06] hover:text-ink",
      )}
    >
      <Icon name="bell" size="md" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 min-w-[1.125rem] rounded-full bg-primary px-1 text-center text-2xs font-semibold leading-[1.125rem] text-primary-fg"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

const MENU_LINKS = [
  { href: "/couple", label: "Couple space", icon: "users" as const },
  { href: "/settings/profile", label: "Your profile", icon: "user" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
];

function AccountMenu({ user }: { user: { name: string; avatarUrl?: string | null } }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const close = () => setOpen(false);

  // Close on click / focus outside.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEscapeKey(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, open);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "tap flex items-center gap-1 rounded-lg pl-1 pr-1.5 transition-colors hover:bg-ink/[0.06]",
          focusRing,
        )}
      >
        <span className="sr-only">Account menu</span>
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        <Icon
          name="chevronDown"
          size="sm"
          className={cn("text-faint transition-transform duration-fast", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="anim-scale-in absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 origin-top-right overflow-hidden rounded-xl border border-line bg-elevated p-1 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-muted">
            Signed in as <span className="font-medium text-ink">{user.name}</span>
          </p>
          <div className="my-1 h-px bg-line" />
          {MENU_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={close}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-ink/[0.06]",
                focusRing,
              )}
            >
              <Icon name={item.icon} size="sm" className="text-faint" />
              {item.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <form action={logoutAction} onSubmit={close}>
            <button
              type="submit"
              role="menuitem"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-ink/[0.06]",
                focusRing,
              )}
            >
              <Icon name="logout" size="sm" className="text-faint" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
