import { ICON_SIZE, type IconSize } from "@/lib/design/tokens";
import { cn } from "@/lib/utils/cn";

interface SpinnerProps {
  size?: IconSize | number;
  className?: string;
  label?: string;
}

/** Indeterminate activity indicator. Honours reduced-motion via the global CSS damper. */
export function Spinner({ size = "sm", className, label = "Loading" }: SpinnerProps) {
  const px = typeof size === "number" ? size : ICON_SIZE[size];
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      role="status"
      aria-label={label}
      className={cn("animate-[mono-spin_0.7s_linear_infinite] text-current", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
