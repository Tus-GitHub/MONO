"use client";

import { Chip } from "@/components/ui/chip";
import { useId } from "react";
import { cn } from "@/lib/utils/cn";

const PRESETS = [
  { label: "Morning", value: "10:00" },
  { label: "Afternoon", value: "14:00" },
  { label: "Evening", value: "19:00" },
];

export function TimeField({
  label,
  value,
  onChange,
  optional,
  disabled,
  className,
  presets = PRESETS,
  errors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
  presets?: { label: string; value: string }[];
  errors?: string[];
}) {
  const id = useId();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {optional ? <span className="text-2xs text-faint">Optional</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Chip
            key={preset.value}
            size="sm"
            disabled={disabled}
            selected={value === preset.value}
            onClick={() => onChange(value === preset.value ? "" : preset.value)}
          >
            {preset.label}
          </Chip>
        ))}
        <input
          type="time"
          id={id}
          disabled={disabled}
          aria-label={`${label} — custom time`}
          value={value}
          aria-invalid={Boolean(errors?.length)}
          aria-describedby={errors?.length ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink shadow-xs",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/35 disabled:opacity-55",
            errors?.length && "border-error focus:border-error focus:ring-error/35",
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>
      {errors?.length ? <p id={`${id}-error`} className="text-xs text-error">{errors.join(" ")}</p> : null}
    </div>
  );
}
