"use client";

import Link from "next/link";
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
    <nav className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
      {TABS.map((tab) => {
        const active =
          tab.href === "/dates" ? pathname === "/dates" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
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
