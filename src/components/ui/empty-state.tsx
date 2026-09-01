import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Calm, encouraging placeholder for "nothing here yet". Not an error. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-primary-tint text-primary">
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
