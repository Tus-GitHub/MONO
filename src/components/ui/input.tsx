import type { ComponentPropsWithRef, ReactNode } from "react";

import { controlSize, disabledControl, type ControlSize } from "@/components/ui/_shared";
import { cn } from "@/lib/utils/cn";

export const fieldBase =
  "w-full rounded-lg border border-line bg-surface text-ink shadow-xs transition-colors " +
  "placeholder:text-faint hover:border-line-strong " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/35 " +
  disabledControl;

const invalidRing = "border-error focus:border-error focus:ring-error/30";

export interface InputProps extends ComponentPropsWithRef<"input"> {
  uiSize?: ControlSize;
  invalid?: boolean;
}

/**
 * Sensible mobile-keyboard defaults per input type, so email / url / numeric fields bring up
 * the right keyboard and don't auto-capitalise or auto-correct. Any explicit prop wins.
 */
const typeHints: Record<string, Partial<ComponentPropsWithRef<"input">>> = {
  email: { inputMode: "email", autoCapitalize: "none", autoCorrect: "off", spellCheck: false },
  url: { inputMode: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false },
  tel: { inputMode: "tel" },
  search: { inputMode: "search" },
  number: { inputMode: "decimal" },
};

export function Input({ className, uiSize = "md", invalid, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      {...(type ? typeHints[type] : undefined)}
      className={cn(
        fieldBase,
        controlSize[uiSize],
        uiSize === "lg" ? "px-4" : "px-3.5",
        invalid && invalidRing,
        className,
      )}
      {...props}
    />
  );
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ className, rows = 4, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        "resize-y px-3.5 py-2.5 text-sm",
        invalid && invalidRing,
        className,
      )}
      {...props}
    />
  );
}

/**
 * Wraps a control with leading/trailing adornments (icons, buttons) while keeping one
 * focus ring around the whole group.
 */
export function InputGroup({
  leading,
  trailing,
  className,
  children,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-surface px-3 shadow-xs transition-colors",
        "hover:border-line-strong focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/35",
        className,
      )}
    >
      {leading ? <span className="shrink-0 text-muted">{leading}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing ? <span className="shrink-0 text-muted">{trailing}</span> : null}
    </div>
  );
}

/** Bare input for use inside <InputGroup> (no border/ring of its own). */
export function BareInput({ className, ...props }: ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none",
        disabledControl,
        className,
      )}
      {...props}
    />
  );
}
