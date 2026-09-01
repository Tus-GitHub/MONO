"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { countdownLabel } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Live countdown badge. The server passes an accurate `initialLabel` (the page is dynamic, so
 * it's fresh at load); the interval keeps it current afterwards.
 */
export function Countdown({
  target,
  initialLabel,
  className,
}: {
  target: string;
  initialLabel: string;
  className?: string;
}) {
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    const id = setInterval(() => setLabel(countdownLabel(target)), 30_000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary",
        className,
      )}
    >
      <Icon name="clock" size={12} />
      {label}
    </span>
  );
}
