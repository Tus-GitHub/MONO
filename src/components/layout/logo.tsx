import Link from "@/components/ui/app-link";
import { cn } from "@/lib/utils/cn";
import { AMOR_LETTERS, AMOR_M, AMOR_O, AMOR_STEM } from "@/lib/brand/wordmark";

/** The M shares its right stem with a dotted i: a hidden Mio inside AMOR. */
export function AmorWordmark({ className }: { className?: string }) {
  return <svg viewBox="0 0 306 128" fill="currentColor" aria-hidden="true" className={cn("amor-wordmark shrink-0", className)}>
    <path d={AMOR_LETTERS} fillRule="evenodd" /><path d={AMOR_M} />
    <path d={AMOR_O} fillRule="evenodd" /><path d={AMOR_STEM} className="fill-primary" />
    <circle cx="145" cy="23" r="4" className="fill-primary" />
  </svg>;
}

/** Shared-stem Mio monogram for the app tile and compact placements. */
export function AmorMark({ className }: { className?: string }) {
  return <svg viewBox="72 10 158 112" fill="currentColor" aria-hidden="true" className={cn("h-[1.15em] w-[1.15em] shrink-0", className)}>
    <path d={AMOR_M} /><path d={AMOR_O} fillRule="evenodd" />
    <path d={AMOR_STEM} className="fill-primary" /><circle cx="145" cy="23" r="4" className="fill-primary" />
  </svg>;
}

type LogoVariant = "lockup" | "wordmark" | "mark";
type LogoSize = "sm" | "md" | "lg";
const SIZE: Record<LogoSize, string> = { sm: "amor-logo-sm", md: "amor-logo-md", lg: "amor-logo-lg" };
interface LogoProps { href?: string | null; variant?: LogoVariant; size?: LogoSize; className?: string }

export function Logo({ href = "/", variant = "lockup", size = "md", className }: LogoProps) {
  const content = <span className={cn("inline-flex min-w-0 max-w-full items-center text-ink", SIZE[size], className)}>
    {variant === "mark" ? <AmorMark /> : <AmorWordmark />}
    <span className="sr-only">{href == null ? "AMOR" : "AMOR home"}</span>
  </span>;
  return href == null ? content : <Link href={href} className="inline-flex min-w-0 max-w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper">{content}</Link>;
}
