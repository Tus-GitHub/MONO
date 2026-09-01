import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Pins a row of primary actions to the bottom of the scroll area (above the mobile nav),
 * with a frosted background and safe-area padding. Use for "Save", "Complete date", etc.
 */
export function StickyBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-elevated/80 px-4 py-3 pb-safe backdrop-blur-md sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <div className="mx-auto flex max-w-(--prose-max) gap-3">{children}</div>
    </div>
  );
}
