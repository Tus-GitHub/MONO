"use client";

import { PendingFields } from "@/components/forms/pending-fields";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PlacePickerSheet } from "./place-picker-sheet";
import { TimeField } from "./time-field";
import type { LocalPlaceChoice } from "@/lib/validation/new-plan";
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
  isFirst,
  isLast,
  onMove,
}: Props) {
  const confirm = useConfirm();
  const [editState, editAction] = useActionState(updateActivityAction, idleState);
  const [, deleteAction] = useActionState(deleteActivityAction, idleState);

  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [venue, setVenue] = useState<LocalPlaceChoice | null | undefined>(undefined);
  const [startTime, setStart] = useState(activity.startTime ?? "");
  const [endTime, setEnd] = useState(activity.endTime ?? "");
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
          <PendingFields className="space-y-3">
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
            <input type="hidden" name="savedPlaceId" value={venue === undefined ? activity.placeId ?? "" : ""} />
            <input type="hidden" name="placeSelection" value={venue ? JSON.stringify(venue.selection) : ""} />
            <input type="hidden" name="description" value={activity.description ?? ""} />
            <input type="hidden" name="startTime" value={startTime} /><input type="hidden" name="endTime" value={endTime} />
            <Button variant="secondary" className="max-w-full" onClick={() => setPicker(true)}><span className="truncate">{venue?.name ?? (venue === undefined ? activity.placeName : null) ?? "Find a venue for this event"}</span></Button>
            {(venue || venue === undefined && activity.placeId) ? <Button variant="link" onClick={() => setVenue(null)}>Remove venue</Button> : null}
            <div className="grid gap-3 sm:grid-cols-2"><TimeField label="Event start time" value={startTime} onChange={setStart} optional errors={fieldErrors?.startTime} />
              <TimeField label="Event end time" value={endTime} onChange={setEnd} presets={[]} optional errors={fieldErrors?.endTime} /></div>
            {editState.status === "error" ? <p role="alert" className="text-xs text-error">{editState.message}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </PendingFields>
        </form>
        <PlacePickerSheet open={picker} onClose={() => setPicker(false)} categoryKey={pickerCategory} onCategoryChange={setPickerCategory} activities={[]}
          onChooseLocal={setVenue} />
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
