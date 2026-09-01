import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
  className?: string;
  optional?: boolean;
}

/** Label + control + inline validation, wired for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
  className,
  optional,
}: FieldProps) {
  const errorId = errors?.length ? `${htmlFor}-error` : undefined;
  const hintId = hint && !errorId ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center justify-between text-sm font-medium text-ink"
      >
        <span>{label}</span>
        {optional ? <span className="text-2xs font-normal text-faint">Optional</span> : null}
      </label>
      {children}
      {hintId ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <ul id={errorId} className="space-y-0.5 text-xs text-error">
          {errors!.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
