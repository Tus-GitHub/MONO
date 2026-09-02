"use client";

import { startTransition, useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { relativeTime } from "@/lib/utils/format";
import { markDatesSeenAction } from "@/server/actions/date";
import type { PartnerActivity as PartnerActivityData } from "@/server/services/date-event-service";

/** A few grouped lines of what the other person did since you last looked. Not a feed. */
export function PartnerActivity({ activity }: { activity: PartnerActivityData }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || activity.items.length === 0) return null;

  const name = activity.actorName ?? "Your partner";

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {name}&apos;s recent activity
        </p>
        <button
          type="button"
          aria-label="Mark as seen"
          onClick={() => {
            setDismissed(true);
            startTransition(() => {
              void markDatesSeenAction();
            });
          }}
          className="text-muted transition-colors hover:text-ink"
        >
          <Icon name="x" size="sm" />
        </button>
      </div>
      <ul className="divide-y divide-line">
        {activity.items.map((item) => (
          <li key={`${item.dateId}-${item.summary}`}>
            <Link
              href={`/dates/${item.dateId}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper/70"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
                <Icon name="pencil" size="sm" />
              </span>
              <p className="min-w-0 flex-1 text-sm text-ink">
                <span className="text-muted">{name} {item.summary} on </span>
                <span className="font-medium">{item.dateTitle}</span>
              </p>
              <span className="shrink-0 text-2xs text-faint">{relativeTime(item.at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
