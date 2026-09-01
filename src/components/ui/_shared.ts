/**
 * Class fragments shared across interactive controls so Button, LinkButton, Input, Select,
 * Search, and friends stay visually identical. Never redefine these per-component.
 */

/** Focus-visible ring, consistent everywhere. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** Disabled treatment. */
export const disabledControl = "disabled:pointer-events-none disabled:opacity-55";

/** Control heights — the design system's three sizes (36 / 44 / 52 px). */
export const controlSize = {
  sm: "h-9 text-sm",
  md: "h-11 text-sm",
  lg: "h-13 text-base",
} as const;

export type ControlSize = keyof typeof controlSize;

/** Horizontal padding paired with each control size. */
export const controlPadX = {
  sm: "px-3",
  md: "px-3.5",
  lg: "px-4",
} as const;

/* -------------------------------------------------------------------------- */
/* Button / LinkButton visual language                                        */
/* -------------------------------------------------------------------------- */

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export const buttonBase =
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out active:translate-y-px";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover active:bg-primary-active",
  accent: "bg-accent text-accent-fg shadow-xs hover:bg-accent-hover active:brightness-95",
  secondary:
    "border border-line bg-surface text-ink hover:border-line-strong hover:bg-elevated",
  outline: "border border-line-strong text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-ink/[0.06] active:bg-ink/[0.1]",
  danger: "bg-error text-primary-fg shadow-xs hover:brightness-95 active:brightness-90",
  link: "text-primary underline-offset-4 hover:underline",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-11 gap-2 rounded-lg px-4 text-sm",
  lg: "h-13 gap-2 rounded-xl px-5 text-base",
  icon: "h-11 w-11 rounded-lg",
};
