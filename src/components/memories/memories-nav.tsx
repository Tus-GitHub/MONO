"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/memories", label: "Journal", exact: true },
  { href: "/memories/timeline", label: "Timeline" },
  { href: "/memories/photos", label: "Photos" },
  { href: "/memories/favorites", label: "Favourites" },
];

export function MemoriesNav() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
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
