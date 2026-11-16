"use client";

import Link from "@/components/ui/app-link";
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
    <nav aria-label="Memories sections" className="grid w-full min-w-0 grid-cols-4 gap-0.5 rounded-xl border border-line bg-surface p-1 text-xs font-medium sm:max-w-md">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1 py-2 transition-colors",
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
