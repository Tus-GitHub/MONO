import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The MONO mark: a hairline ring and a filled clay disc, overlapping so two forms read as
 * one. It stands for "two people, one space" — and for the name — without a single heart.
 */
export function MonoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-[1.15em] w-[1.15em] shrink-0", className)}
    >
      <circle cx="12.6" cy="16" r="8" stroke="currentColor" strokeWidth="2.25" />
      <circle cx="19.4" cy="16" r="8" className="fill-primary" />
    </svg>
  );
}

type LogoVariant = "lockup" | "wordmark" | "mark";
type LogoSize = "sm" | "md" | "lg";

const SIZE: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

interface LogoProps {
  href?: string | null;
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

export function Logo({ href = "/", variant = "lockup", size = "md", className }: LogoProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-ink",
        SIZE[size],
        className,
      )}
    >
      {variant !== "wordmark" ? <MonoMark /> : null}
      {variant !== "mark" ? (
        <span className="font-display font-medium uppercase leading-none tracking-[0.34em]">
          MONO
        </span>
      ) : null}
      <span className="sr-only">MONO home</span>
    </span>
  );

  if (href == null) return content;

  return (
    <Link
      href={href}
      className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      {content}
    </Link>
  );
}
