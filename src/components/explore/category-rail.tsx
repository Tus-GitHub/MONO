import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { EXPLORE_CATEGORIES } from "@/lib/date/explore-categories";
import { cn } from "@/lib/utils/cn";

/** Horizontally-scrollable browse categories. */
export function CategoryRail({
  activeKey,
  forDate,
}: {
  activeKey?: string;
  forDate?: string;
}) {
  const suffix = forDate ? `&forDate=${forDate}` : "";
  return (
    <div className="scroll-x no-scrollbar -mx-4 flex gap-2.5 px-4 sm:mx-0 sm:px-0">
      {EXPLORE_CATEGORIES.map((category) => {
        const href =
          category.kind === "custom"
            ? `/explore?view=custom${suffix}`
            : category.kind === "curated"
              ? `/explore?view=hidden${suffix}`
              : `/explore?category=${category.key}${suffix}`;
        const active = activeKey === category.key;
        return (
          <Link
            key={category.key}
            href={href}
            className={cn(
              "flex w-20 shrink-0 flex-col items-center gap-2 rounded-xl border border-line p-3 text-center transition-colors",
              active ? "border-primary bg-primary-tint/40" : "bg-surface hover:border-line-strong",
            )}
          >
            <span className={cn("grid size-9 place-items-center rounded-lg", category.tint)}>
              <Icon name={category.icon} size="sm" />
            </span>
            <span className="text-2xs font-medium leading-tight text-ink">{category.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
