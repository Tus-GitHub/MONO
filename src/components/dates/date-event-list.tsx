import { DateEventKind } from "@prisma/client";

import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { relativeTime } from "@/lib/utils/format";
import type { DateEventView } from "@/server/services/date-event-service";

const KIND_ICON: Record<DateEventKind, IconName> = {
  CREATED: "calendarPlus",
  TITLE_CHANGED: "pencil",
  TIME_CHANGED: "clock",
  PLACE_CHANGED: "mapPin",
  NOTES_CHANGED: "pencil",
  BUDGET_CHANGED: "wallet",
  ACTIVITY_ADDED: "plus",
  ACTIVITY_UPDATED: "pencil",
  ACTIVITY_REMOVED: "trash",
  ACTIVITY_REORDERED: "refresh",
  STATUS_CHANGED: "calendarCheck",
  ACTUALS_RECORDED: "calendarCheck",
  PHOTO_ADDED: "camera",
  BEST_PHOTO_SET: "star",
  REVIEW_WRITTEN: "star",
  REVISIT_DECIDED: "refresh",
  MEMORY_CREATED: "images",
};

/** The date's collaboration log — contextual, quiet, scoped to this date only. */
export function DateEventList({
  events,
  currentUserId,
}: {
  events: DateEventView[];
  currentUserId: string;
}) {
  if (events.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">Activity</h2>
      <ul className="space-y-3">
        {events.map((event) => {
          const you = event.actor.id === currentUserId;
          return (
            <li key={event.id} className="flex items-start gap-3">
              <Avatar name={event.actor.name} src={event.actor.avatarUrl} size="xs" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-ink">
                  <span className="font-medium">{you ? "You" : event.actor.name}</span>{" "}
                  <span className="text-muted">{event.summary}</span>
                </p>
                <p className="text-2xs text-faint">{relativeTime(event.createdAt)}</p>
              </div>
              <Icon name={KIND_ICON[event.kind]} size={13} className="mt-1 shrink-0 text-faint" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
