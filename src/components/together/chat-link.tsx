"use client";
import Link from "@/components/ui/app-link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/_shared";
import { cn } from "@/lib/utils/cn";
import { useTogetherCall } from "./together-provider";
export function ChatLink() {
  const { unread } = useTogetherCall();
  return <Link href="/chat" aria-label={unread ? `Chat and games, ${unread} unread` : "Chat and games"} className={cn("tap relative grid place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink", focusRing)}>
    <Icon name="message" size="md" />
    {unread ? <span className="absolute right-0 top-0 rounded-full bg-primary px-1 text-2xs text-primary-fg">{unread > 9 ? "9+" : unread}</span> : null}
  </Link>;
}
