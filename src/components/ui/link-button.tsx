import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import {
  buttonBase,
  buttonSizes,
  buttonVariants,
  focusRing,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/_shared";
import { cn } from "@/lib/utils/cn";

interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
}

/** A link that looks and behaves like a <Button>. Use when navigation, not an action, is intended. */
export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        buttonBase,
        focusRing,
        buttonVariants[variant],
        variant === "link" ? "h-auto gap-1 p-0" : buttonSizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center", variant === "link" ? "gap-1" : "gap-2")}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
    </Link>
  );
}
