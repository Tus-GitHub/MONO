"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

/** Preserve Next's prefetch/navigation behavior and acknowledge an in-flight navigation. */
export default function AppLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationPending /></Link>;
}

function NavigationPending() {
  const { pending } = useLinkStatus();
  if (!pending || typeof document === "undefined") return null;
  return createPortal(
    <div data-navigation-pending role="status" aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 bg-primary motion-safe:animate-pulse">
      <span className="sr-only">Opening page…</span>
    </div>, document.body,
  );
}
