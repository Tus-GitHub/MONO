import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Pins a row of primary actions to the bottom of the scroll area, with a frosted background.
 * On mobile it sits clear of BOTH the fixed bottom nav and the iPhone home indicator; on
 * desktop it pins to the bottom edge. Use for "Save", "Complete date", etc.
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
        "above-bottom-nav sticky z-20 -mx-4 mt-6 border-t border-line bg-elevated/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:bottom-0",
        className,
      )}
    >
      <div className="mx-auto flex max-w-(--prose-max) gap-3">{children}</div>
    </div>
  );
}
