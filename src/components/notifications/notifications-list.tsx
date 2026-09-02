"use client";

import { startTransition } from "react";
import Link from "next/link";
import type { NotificationType } from "@prisma/client";

import { Icon } from "@/components/ui/icon";
import { NOTIFICATION_ICON, notificationHref } from "@/lib/notifications/types";
import { relativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { markNotificationReadAction } from "@/server/actions/notifications";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

function Row({ n }: { n: NotificationRow }) {
  const href = notificationHref(n);
  const unread = n.readAt == null;

  return (
    <li>
      <Link
        href={href}
        onClick={() => {
          if (!unread) return;
          const fd = new FormData();
          fd.set("id", n.id);
          startTransition(() => void markNotificationReadAction(fd));
        }}
        className={cn(
          "flex gap-3 px-4 py-3.5 transition-colors hover:bg-paper/70",
          unread && "bg-primary-tint/25",
        )}
      >
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
          <Icon name={NOTIFICATION_ICON[n.type]} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{n.title}</p>
          {n.body ? <p className="mt-0.5 text-sm text-muted">{n.body}</p> : null}
          <p className="mt-1 text-2xs text-faint">{relativeTime(n.createdAt)}</p>
        </div>
        {unread ? (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
        ) : null}
      </Link>
    </li>
  );
}

export function NotificationsList({ items }: { items: NotificationRow[] }) {
  const unread = items.filter((n) => n.readAt == null);
  const earlier = items.filter((n) => n.readAt != null);

  return (
    <div className="space-y-6">
      {unread.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">New</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {unread.map((n) => (
              <Row key={n.id} n={n} />
            ))}
          </ul>
        </section>
      ) : null}

      {earlier.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Earlier
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {earlier.map((n) => (
              <Row key={n.id} n={n} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
