"use client";

import Link from "@/components/ui/app-link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/dates/history", label: "History" },
  { href: "/dates", label: "Calendar" },
  { href: "/dates/upcoming", label: "Upcoming" },
];

/** Segmented control across the three "Our Dates" views. */
export function DatesNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dates views"
      className="inline-flex rounded-xl border border-line bg-surface p-1 text-xs font-medium"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/dates" ? pathname === "/dates" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 py-2 transition-colors",
              active ? "bg-primary text-primary-fg" : "text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
