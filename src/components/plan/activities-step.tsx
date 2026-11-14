"use client";

import { startTransition, useActionState, useOptimistic, useState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { ActivityRow } from "@/components/plan/activity-row";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { Timeline } from "@/components/plan/timeline";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { ACTIVITY_PRESETS } from "@/lib/date/activity-palette";
import { buildTimeline } from "@/lib/date/timeline";
import { planStepHref } from "@/lib/date/plan-steps";
import { idleState, type ActionState } from "@/lib/utils/result";
import { formatWallTime, wallTimeFromIso } from "@/lib/utils/format";
import { addActivityAction, reorderActivitiesAction } from "@/server/actions/plan";
import type {
  PlanActivityDTO,
  PlanDateDTO,
  SavedPlaceOption,
} from "@/server/services/plan-service";

export function ActivitiesStep({
  plan,
  savedPlaces,
}: {
  plan: PlanDateDTO;
  savedPlaces: SavedPlaceOption[];
}) {
  const [custom, setCustom] = useState("");
  const [addState, addAction, adding] = useActionState(async (previous: ActionState, formData: FormData) => {
    try {
      const result = await addActivityAction(previous, formData);
      if (result.status === "success") setCustom((current) => current.trim() === formData.get("title") ? "" : current);
      return result;
    } catch { return { status: "error" as const, message: "That didn't save. Please try again." }; }
  }, idleState);
  const [reorderState, reorderAction, reordering] = useActionState(reorderActivitiesAction, idleState);
  const busy = adding || reordering;
  const [order, setOrder] = useOptimistic<PlanActivityDTO[]>(plan.activities);

  const add = (title: string, durationMinutes?: number) => {
    if (busy || !title.trim()) return;
    const fd = new FormData();
    fd.set("dateId", plan.id);
    fd.set("title", title.trim());
    if (durationMinutes) fd.set("durationMinutes", String(durationMinutes));
    startTransition(() => addAction(fd));
  };

  const move = (id: string, direction: -1 | 1) => {
    if (busy) return;
    const index = order.findIndex((activity) => activity.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    const ids = next.map((activity) => activity.id);
    startTransition(() => {
      setOrder(next);
      const fd = new FormData();
      fd.set("dateId", plan.id);
      fd.set("ids", ids.join(","));
      reorderAction(fd);
    });
  };

  const slots = buildTimeline(plan.plannedStartIso, order);

  return (
    <div className="space-y-6">
      <PlanStepper dateId={plan.id} current="activities" disabled={busy} />

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-medium text-ink">Events</h1>
        <p className="text-sm text-muted">
          Add each event with its own venue and time, then put them in order.
        </p>
      </div>

      <FormFeedback state={addState} />
      <FormFeedback state={reorderState} />

      <div className="flex flex-wrap gap-2">
        {ACTIVITY_PRESETS.map((preset) => (
          <Chip
            key={preset.key}
            leadingIcon={<Icon name={preset.icon} size={13} />}
            onClick={() => add(preset.title, preset.durationMinutes)}
            disabled={busy}
          >
            {preset.title}
          </Chip>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(custom);
            }
          }}
          placeholder="Something else…"
          aria-label="Custom activity"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            add(custom);
          }}
          disabled={!custom.trim() || busy}
        >
          Add
        </Button>
      </div>

      {order.length > 0 ? (
        <ul className="space-y-2">
          {order.map((activity, index) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              dateId={plan.id}
              currency={plan.currency}
              savedPlaces={savedPlaces}
              isFirst={index === 0}
              isLast={index === order.length - 1}
              timeLabel={
                slots[index]?.startAt
                  ? `${formatWallTime(wallTimeFromIso(slots[index].startAt))}`
                  : ""
              }
              onMove={(direction) => move(activity.id, direction)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-sm text-muted">
          No activities yet. Tap one above to start.
        </p>
      )}

      {order.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">Timeline</p>
          <Timeline activities={order} startIso={plan.plannedStartIso} currency={plan.currency} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <LinkButton href={planStepHref(plan.id, "budget")} variant="ghost" size="md" disabled={busy}>
          Back
        </LinkButton>
        <div className="flex gap-2">
          <LinkButton href="/plan" variant="ghost" size="md" disabled={busy}>
            Save &amp; exit
          </LinkButton>
          <LinkButton href={planStepHref(plan.id, "review")} size="md" disabled={busy}>
            Continue
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
