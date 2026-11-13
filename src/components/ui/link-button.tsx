import Link from "@/components/ui/app-link";
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
  disabled?: boolean;
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
  disabled = false,
  ...props
}: LinkButtonProps) {
  const classes = cn(buttonBase, focusRing, buttonVariants[variant],
    variant === "link" ? "h-auto gap-1 p-0" : buttonSizes[size], fullWidth && "w-full", className);
  const content = (
    <span className={cn("inline-flex min-w-0 max-w-full items-center", variant === "link" ? "gap-1" : "gap-2")}>
      {leadingIcon}{children}{trailingIcon}
    </span>
  );
  if (disabled) return <span role="link" aria-disabled="true" className={cn(classes, "pointer-events-none opacity-55")}>{content}</span>;
  return <Link className={classes} {...props}>{content}</Link>;
}
