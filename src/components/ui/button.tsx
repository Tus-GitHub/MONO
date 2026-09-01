import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  buttonBase,
  buttonSizes,
  buttonVariants,
  disabledControl,
  focusRing,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/_shared";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";

export type { ButtonVariant, ButtonSize };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonBase,
        focusRing,
        disabledControl,
        buttonVariants[variant],
        variant === "link" ? "h-auto gap-1 p-0" : buttonSizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {size === "icon" ? (
        loading ? <Spinner size="sm" /> : children
      ) : (
        <span
          className={cn("inline-flex items-center", variant === "link" ? "gap-1" : "gap-2")}
        >
          {loading ? <Spinner size="sm" /> : leadingIcon}
          {children}
          {trailingIcon}
        </span>
      )}
    </button>
  );
}
