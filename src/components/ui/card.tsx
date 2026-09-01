import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface CardProps {
  className?: string;
  children: ReactNode;
  /** Adds hover lift + shadow; pair with a wrapping <Link> for navigable cards. */
  interactive?: boolean;
  padded?: boolean;
}

export function Card({ className, children, interactive, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-sm",
        padded && "p-5",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-fast ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-display text-base font-medium text-ink">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("text-sm text-ink", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("mt-4 flex items-center gap-3 border-t border-line pt-4", className)}>
      {children}
    </div>
  );
}
