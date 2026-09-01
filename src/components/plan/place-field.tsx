"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { PlacePickerSheet } from "@/components/plan/place-picker-sheet";
import { Icon } from "@/components/ui/icon";
import { idleState } from "@/lib/utils/result";
import { clearDatePlaceAction } from "@/server/actions/place";

export function PlaceField({
  dateId,
  place,
}: {
  dateId: string;
  place: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, clear] = useActionState(clearDatePlaceAction, idleState);
  const [lastSeen, setLastSeen] = useState<typeof state>(idleState);

  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.status === "success") router.refresh();
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Where?</p>

      {place ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
            <Icon name="mapPin" size="sm" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {place.name}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => {
              const fd = new FormData();
              fd.set("dateId", dateId);
              startTransition(() => clear(fd));
            }}
            aria-label="Remove place"
            className="text-muted transition-colors hover:text-error"
          >
            <Icon name="x" size="sm" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-3.5 py-2.5 text-sm text-muted transition-colors hover:border-primary hover:text-ink"
        >
          <Icon name="plus" size="sm" />
          Add a place
        </button>
      )}

      <PlacePickerSheet dateId={dateId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
