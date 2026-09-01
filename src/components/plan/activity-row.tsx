"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { idleState, type ActionState } from "@/lib/utils/result";
import { formatDurationMinutes, formatMoney } from "@/lib/utils/format";
import {
  deleteActivityAction,
  updateActivityAction,
} from "@/server/actions/plan";
import type { PlanActivityDTO, SavedPlaceOption } from "@/server/services/plan-service";

interface Props {
  activity: PlanActivityDTO;
  dateId: string;
  timeLabel: string;
  currency: string;
  savedPlaces: SavedPlaceOption[];
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}

export function ActivityRow({
  activity,
  dateId,
  timeLabel,
  currency,
  savedPlaces,
  isFirst,
  isLast,
  onMove,
}: Props) {
  const confirm = useConfirm();
  const [editState, editAction] = useActionState(updateActivityAction, idleState);
  const [, deleteAction] = useActionState(deleteActivityAction, idleState);

  const [editing, setEditing] = useState(false);
  const [lastSeen, setLastSeen] = useState<ActionState>(idleState);
  if (editState !== lastSeen) {
    setLastSeen(editState);
    if (editState.status === "success" && editing) setEditing(false);
  }
  const fieldErrors = editState.status === "error" ? editState.fieldErrors : undefined;

  const remove = async () => {
    const ok = await confirm({
      title: "Remove this activity?",
      description: activity.title,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("activityId", activity.id);
    deleteAction(fd);
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-primary/30 bg-surface p-3">
        <form action={editAction} className="space-y-3" noValidate>
          <input type="hidden" name="dateId" value={dateId} />
          <input type="hidden" name="activityId" value={activity.id} />
          <Input
            name="title"
            defaultValue={activity.title}
            aria-label="Activity name"
            invalid={Boolean(fieldErrors?.title)}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              name="durationMinutes"
              type="number"
              min="5"
              step="5"
              defaultValue={activity.durationMinutes ?? ""}
              placeholder="Minutes"
              aria-label="Duration in minutes"
            />
            <Input
              name="costCents"
              type="number"
              min="0"
              step="0.01"
              defaultValue={activity.costCents != null ? activity.costCents / 100 : ""}
              placeholder="Cost"
              aria-label="Estimated cost"
            />
          </div>
          {savedPlaces.length > 0 ? (
            <Select
              name="savedPlaceId"
              defaultValue={activity.placeId ?? ""}
              aria-label="Place for this activity"
            >
              <option value="">No specific place</option>
              {savedPlaces.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </Select>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move earlier"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className="grid size-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-30"
        >
          <Icon name="chevronUp" size="sm" />
        </button>
        <button
          type="button"
          aria-label="Move later"
          disabled={isLast}
          onClick={() => onMove(1)}
          className="grid size-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-30"
        >
          <Icon name="chevronDown" size="sm" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {timeLabel ? <span className="text-muted">{timeLabel} · </span> : null}
          {activity.title}
        </p>
        <p className="truncate text-xs text-muted">
          {formatDurationMinutes(activity.durationMinutes) || "no duration set"}
          {activity.costCents ? ` · ${formatMoney(activity.costCents, currency)}` : ""}
          {activity.placeName ? ` · ${activity.placeName}` : ""}
        </p>
      </div>

      <button
        type="button"
        aria-label="Edit activity"
        onClick={() => setEditing(true)}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
      >
        <Icon name="pencil" size="sm" />
      </button>
      <button
        type="button"
        aria-label="Remove activity"
        onClick={remove}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-error-tint hover:text-error"
      >
        <Icon name="trash" size="sm" />
      </button>
    </li>
  );
}
