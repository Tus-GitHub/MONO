"use client";

import { startTransition, useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { relativeTime } from "@/lib/utils/format";
import { markDatesSeenAction } from "@/server/actions/date";
import type { PartnerEditView } from "@/server/services/date-event-service";

/** One quiet line about the partner's most recent change. Not a feed. */
export function PartnerActivityBanner({ edit }: { edit: PartnerEditView }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
        <Icon name="pencil" size="sm" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink">
        <span className="font-medium">{edit.actorName}</span>{" "}
        <span className="text-muted">
          {edit.summary} on{" "}
          <Link href={`/dates/${edit.dateId}`} className="text-primary hover:underline">
            {edit.dateTitle}
          </Link>
          {edit.unseenCount > 1 ? ` · +${edit.unseenCount - 1} more change${edit.unseenCount - 1 === 1 ? "" : "s"}` : ""}
          {" · "}
          {relativeTime(edit.at)}
        </span>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          startTransition(() => {
            void markDatesSeenAction();
          });
        }}
        className="shrink-0 text-muted transition-colors hover:text-ink"
      >
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}
