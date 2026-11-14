"use client";
import type { ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export function CallControl({ icon, label, active, tone, ...props }: ComponentProps<"button"> & {
  icon: ComponentProps<typeof Icon>["name"]; label: string; active?: boolean; tone?: "danger" | "success";
}) {
  return <button type="button" {...props} aria-label={label} aria-pressed={active} className="group flex min-w-0 flex-col items-center gap-1 rounded-xl p-1 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40">
    <span className={cn("grid size-11 place-items-center rounded-full transition-colors sm:size-12", tone === "danger" ? "bg-error text-white" : tone === "success" ? "bg-success text-white" : active ? "bg-white text-black" : "bg-white/15 group-hover:bg-white/25")}><Icon name={icon} /></span>
    <span className="text-center text-2xs leading-tight sm:text-xs">{label}</span>
  </button>;
}
