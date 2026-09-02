import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type PageWidth = "narrow" | "default" | "wide" | "full";

const widthClass: Record<PageWidth, string> = {
  // Focused forms and settings — comfortable single-column reading measure.
  narrow: "max-w-(--content-narrow)",
  // The everyday column: home, plan, a date, couple.
  default: "max-w-(--content-max)",
  // Galleries, photo walls and timelines that earn the extra horizontal room.
  wide: "max-w-(--content-wide)",
  // Edge-to-edge within the shell's own padding.
  full: "max-w-none",
};

/**
 * The per-page content column. The app shell only supplies gutters and an outer bound; each
 * page picks the measure that suits it, so desktop layouts are intentional rather than a
 * stretched phone screen. Always exactly one per page, wrapping the page root.
 */
export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full", widthClass[width], className)}>{children}</div>
  );
}
