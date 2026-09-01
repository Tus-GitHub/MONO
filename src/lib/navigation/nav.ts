import type { IconName } from "@/components/ui/icon";

export interface NavItem {
  key: string;
  label: string;
  /** Short label for the mobile bottom nav. */
  short: string;
  href: string;
  icon: IconName;
  /** Match `href` and any nested path. */
  match?: (pathname: string) => boolean;
}

const startsWith = (base: string) => (pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** The authenticated destinations, in priority order. */
export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", short: "Home", href: "/home", icon: "home", match: startsWith("/home") },
  { key: "plan", label: "Plan Date", short: "Plan", href: "/plan", icon: "calendarPlus", match: startsWith("/plan") },
  { key: "dates", label: "Our Dates", short: "Dates", href: "/dates", icon: "calendar", match: startsWith("/dates") },
  { key: "memories", label: "Memories", short: "Memories", href: "/memories", icon: "images", match: startsWith("/memories") },
  { key: "explore", label: "Explore", short: "Explore", href: "/explore", icon: "compass", match: startsWith("/explore") },
  { key: "couple", label: "Couple", short: "Couple", href: "/couple", icon: "users", match: startsWith("/couple") },
];

/** Bottom-nav slots on mobile: four tabs plus the centre "Plan a Date" action. */
export const MOBILE_TAB_KEYS = ["home", "dates", "memories", "couple"] as const;

export const PLAN_HREF = "/plan";

export function isActive(item: NavItem, pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname === item.href;
}
