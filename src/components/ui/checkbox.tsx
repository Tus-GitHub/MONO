import type { ComponentPropsWithRef, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils/cn";

export function Checkbox({ className, ...props }: ComponentPropsWithRef<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 rounded border-line-strong accent-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        className,
      )}
      {...props}
    />
  );
}

/** Checkbox + label as one clickable row. */
export function CheckboxField({
  label,
  className,
  id,
  ...props
}: ComponentPropsWithRef<"input"> & { label: ReactNode }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className={cn("flex cursor-pointer items-center gap-2.5", className)}>
      <Checkbox id={fieldId} {...props} />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}
