import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, { box: string; icon: string; glyph: IconName }> = {
  info: { box: "border-line bg-surface text-ink", icon: "text-muted", glyph: "info" },
  success: {
    box: "border-success/30 bg-success-tint text-ink",
    icon: "text-success",
    glyph: "checkCircle",
  },
  warning: {
    box: "border-warning/30 bg-warning-tint text-ink",
    icon: "text-warning",
    glyph: "alertTriangle",
  },
  error: {
    box: "border-error/30 bg-error-tint text-ink",
    icon: "text-error",
    glyph: "alertCircle",
  },
};

interface AlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: boolean;
  className?: string;
}

export function Alert({ tone = "info", title, children, icon = true, className }: AlertProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-sm", t.box, className)}
    >
      {icon ? <Icon name={t.glyph} size="sm" className={cn("mt-0.5", t.icon)} /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className={title ? "mt-0.5 text-muted" : undefined}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}
