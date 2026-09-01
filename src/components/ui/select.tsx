import type { SelectHTMLAttributes } from "react";

import { controlSize, disabledControl, type ControlSize } from "@/components/ui/_shared";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  uiSize?: ControlSize;
  invalid?: boolean;
}

/**
 * Styled native <select> — reliable across devices, real keyboard + mobile wheel behaviour,
 * with a custom chevron. For rich multi-select or search-in-list, build on <Modal>/<Combobox>.
 */
export function Select({ className, uiSize = "md", invalid, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full appearance-none rounded-lg border border-line bg-surface pr-10 text-ink shadow-xs transition-colors",
          "hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/35",
          controlSize[uiSize],
          uiSize === "lg" ? "pl-4" : "pl-3.5",
          invalid && "border-error focus:border-error focus:ring-error/30",
          disabledControl,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size="sm"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
