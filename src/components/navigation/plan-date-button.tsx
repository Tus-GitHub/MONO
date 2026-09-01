import Link from "next/link";

import { focusRing } from "@/components/ui/_shared";
import { Icon } from "@/components/ui/icon";
import { PLAN_HREF } from "@/lib/navigation/nav";
import { cn } from "@/lib/utils/cn";

/** The one obvious, tasteful "Plan a Date" call to action. */
export function PlanDateButton({
  fullWidth,
  className,
}: {
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={PLAN_HREF}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-sm transition-[background-color,transform] duration-fast ease-out hover:bg-primary-hover active:translate-y-px active:bg-primary-active",
        focusRing,
        fullWidth && "w-full",
        className,
      )}
    >
      <Icon name="plus" size="sm" />
      Plan a date
    </Link>
  );
}
