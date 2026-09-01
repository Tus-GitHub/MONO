"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { focusRing } from "@/components/ui/_shared";
import { Icon } from "@/components/ui/icon";
import { isActive, MOBILE_TAB_KEYS, NAV_ITEMS, PLAN_HREF } from "@/lib/navigation/nav";
import { cn } from "@/lib/utils/cn";

const TABS = MOBILE_TAB_KEYS.map((key) => NAV_ITEMS.find((item) => item.key === key)!);
const [tabA, tabB] = [TABS.slice(0, 2), TABS.slice(2)];

/** Polished mobile bottom navigation with a raised centre "Plan a date" action. */
export function BottomNav() {
  const pathname = usePathname();
  const planActive = pathname === PLAN_HREF || pathname.startsWith(`${PLAN_HREF}/`);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-elevated/85 pb-safe backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {tabA.map((item) => (
          <Tab key={item.key} item={item} active={isActive(item, pathname)} />
        ))}

        <div className="flex justify-center">
          <Link
            href={PLAN_HREF}
            aria-label="Plan a date"
            aria-current={planActive ? "page" : undefined}
            className={cn(
              "grid size-14 -translate-y-4 place-items-center rounded-full bg-primary text-primary-fg shadow-lg ring-4 ring-elevated transition-transform duration-fast ease-out active:-translate-y-3.5 active:scale-95",
              focusRing,
            )}
          >
            <Icon name="plus" size="lg" />
          </Link>
        </div>

        {tabB.map((item) => (
          <Tab key={item.key} item={item} active={isActive(item, pathname)} />
        ))}
      </div>
    </nav>
  );
}

function Tab({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap relative flex flex-col items-center justify-center gap-1 rounded-lg text-2xs font-medium transition-colors",
        focusRing,
        active ? "text-primary" : "text-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 h-0.5 w-6 rounded-full bg-primary transition-opacity duration-fast",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon name={item.icon} size="md" className={active ? "text-primary" : "text-faint"} />
      <span>{item.short}</span>
    </Link>
  );
}
