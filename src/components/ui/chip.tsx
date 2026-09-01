"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/_shared";
import { cn } from "@/lib/utils/cn";

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  leadingIcon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}

/** Filter / selection / removable token. Interactive when given `onClick` or `onRemove`. */
export function Chip({
  children,
  selected,
  onClick,
  onRemove,
  leadingIcon,
  size = "md",
  className,
  disabled,
}: ChipProps) {
  const interactive = Boolean(onClick);
  const shape = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors duration-fast",
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
    selected
      ? "border-primary bg-primary-tint text-primary"
      : "border-line bg-surface text-muted",
    interactive && !selected && "hover:border-line-strong hover:text-ink",
    interactive && "active:scale-[0.98]",
    disabled && "pointer-events-none opacity-55",
  );

  const inner = (
    <>
      {leadingIcon}
      <span className="truncate">{children}</span>
      {onRemove ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="-mr-1 grid size-4 place-items-center rounded-full text-current/70 hover:text-current"
        >
          <Icon name="x" size={12} />
        </span>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        className={cn(shape, focusRing, className)}
      >
        {inner}
      </button>
    );
  }

  return <span className={cn(shape, className)}>{inner}</span>;
}
