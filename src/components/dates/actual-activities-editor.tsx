"use client";

import { startTransition, useActionState, useOptimistic, useState } from "react";

import { MoneyInput } from "@/components/dates/money-input";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CheckboxField } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ACTIVITY_PRESETS } from "@/lib/date/activity-palette";
import { formatMoney } from "@/lib/utils/format";
import { idleState, type ActionState } from "@/lib/utils/result";
import {
  addActualActivityAction,
  deleteActualActivityAction,
  reorderActualActivitiesAction,
  seedActualsFromPlanAction,
  updateActualActivityAction,
} from "@/server/actions/date";
import type { ActualActivityDTO } from "@/server/services/actuals-service";

export function ActualActivitiesEditor({
  dateId,
  activities,
  hasPlan,
  currency,
}: {
  dateId: string;
  activities: ActualActivityDTO[];
  hasPlan: boolean;
  currency: string;
}) {
  const [addState, addAction, adding] = useActionState(addActualActivityAction, idleState);
  const [seedState, seedAction, seeding] = useActionState(seedActualsFromPlanAction, idleState);
  const [, reorderAction] = useActionState(reorderActualActivitiesAction, idleState);
  const [order, setOrder] = useOptimistic<ActualActivityDTO[]>(activities);
  const [custom, setCustom] = useState("");
  const [customUnplanned, setCustomUnplanned] = useState(false);

  const add = (title: string, unplanned: boolean) => {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("dateId", dateId);
    fd.set("title", title.trim());
    if (unplanned) fd.set("unplanned", "on");
    startTransition(() => addAction(fd));
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = order.findIndex((activity) => activity.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(() => {
      setOrder(next);
      const fd = new FormData();
      fd.set("dateId", dateId);
      fd.set("ids", next.map((activity) => activity.id).join(","));
      reorderAction(fd);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">What you actually did</h2>
        <p className="text-sm text-muted">
          The real running order. Mark anything that wasn&apos;t in the plan as a detour.
        </p>
      </div>

      <FormFeedback state={addState} />
      <FormFeedback state={seedState} />

      {order.length === 0 && hasPlan ? (
        <form action={seedAction}>
          <input type="hidden" name="dateId" value={dateId} />
          <Button type="submit" variant="secondary" size="sm" loading={seeding}>
            Start from the plan
          </Button>
          <span className="ml-2 text-xs text-muted">then change whatever went differently</span>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ACTIVITY_PRESETS.map((preset) => (
          <Chip
            key={preset.key}
            leadingIcon={<Icon name={preset.icon} size={13} />}
            onClick={() => add(preset.title, false)}
            disabled={adding}
          >
            {preset.title}
          </Chip>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface/60 p-3">
        <div className="flex gap-2">
          <Input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(custom, customUnplanned);
                setCustom("");
              }
            }}
            placeholder="Something you did…"
            aria-label="Activity name"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              add(custom, customUnplanned);
              setCustom("");
            }}
            disabled={!custom.trim() || adding}
          >
            Add
          </Button>
        </div>
        <CheckboxField
          label="This wasn't in the plan (a detour / extra stop)"
          checked={customUnplanned}
          onChange={(event) => setCustomUnplanned(event.target.checked)}
        />
      </div>

      {order.length > 0 ? (
        <ul className="space-y-2">
          {order.map((activity, index) => (
            <ActualRow
              key={activity.id}
              activity={activity}
              dateId={dateId}
              currency={currency}
              isFirst={index === 0}
              isLast={index === order.length - 1}
              onMove={(direction) => move(activity.id, direction)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">
          Nothing recorded yet. Tap a chip above, or add your own.
        </p>
      )}
    </div>
  );
}

function ActualRow({
  activity,
  dateId,
  currency,
  isFirst,
  isLast,
  onMove,
}: {
  activity: ActualActivityDTO;
  dateId: string;
  currency: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const confirm = useConfirm();
  const [editState, editAction] = useActionState(updateActualActivityAction, idleState);
  const [, deleteAction] = useActionState(deleteActualActivityAction, idleState);
  const [editing, setEditing] = useState(false);
  const [lastSeen, setLastSeen] = useState<ActionState>(idleState);

  if (editState !== lastSeen) {
    setLastSeen(editState);
    if (editState.status === "success" && editing) setEditing(false);
  }
  const fieldErrors = editState.status === "error" ? editState.fieldErrors : undefined;

  const remove = async () => {
    const ok = await confirm({
      title: "Remove this?",
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
            <MoneyInput
              id={`cost-${activity.id}`}
              name="costCents"
              defaultValue={activity.costCents != null ? String(activity.costCents / 100) : ""}
            />
            <Input
              name="note"
              defaultValue={activity.note ?? ""}
              placeholder="Note (optional)"
              aria-label="Note"
            />
          </div>
          <CheckboxField
            label="Wasn't in the plan"
            name="unplanned"
            defaultChecked={activity.unplanned}
          />
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
        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
          {activity.title}
          {activity.unplanned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-2xs font-medium text-accent">
              <Icon name="sparkles" size={11} />
              detour
            </span>
          ) : null}
        </p>
        {activity.note || activity.costCents ? (
          <p className="truncate text-xs text-muted">
            {activity.costCents ? formatMoney(activity.costCents, currency) : ""}
            {activity.costCents && activity.note ? " · " : ""}
            {activity.note ?? ""}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Edit"
        onClick={() => setEditing(true)}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
      >
        <Icon name="pencil" size="sm" />
      </button>
      <button
        type="button"
        aria-label="Remove"
        onClick={remove}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-error-tint hover:text-error"
      >
        <Icon name="trash" size="sm" />
      </button>
    </li>
  );
}
