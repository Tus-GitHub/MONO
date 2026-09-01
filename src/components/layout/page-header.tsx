import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: { href: string; label?: string };
  className?: string;
}

/** Consistent page title block. Pairs with the app frame's max-width container. */
export function PageHeader({ title, description, action, back, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <Icon name="chevronLeft" size="sm" />
          {back.label ?? "Back"}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-[1.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-prose text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
