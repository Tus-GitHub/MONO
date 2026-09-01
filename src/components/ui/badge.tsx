import type { ReactNode } from "react";
import { DateStatus } from "@prisma/client";

import { cn } from "@/lib/utils/cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "error";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-line/60 text-muted",
  primary: "bg-primary-tint text-primary",
  accent: "bg-accent-tint text-accent",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  error: "bg-error-tint text-error",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function Badge({ children, tone = "neutral", size = "md", dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const DATE_STATUS_META: Record<DateStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PLANNED: { label: "Planned", tone: "primary" },
  TODAY: { label: "Today", tone: "accent" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "error" },
};

export function DateStatusBadge({
  status,
  size = "md",
}: {
  status: DateStatus;
  size?: "sm" | "md";
}) {
  const meta = DATE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}
