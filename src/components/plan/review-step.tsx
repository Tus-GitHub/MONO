"use client";

import { useActionState } from "react";
import { DateStatus } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { Timeline } from "@/components/plan/timeline";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { planStepHref } from "@/lib/date/plan-steps";
import {
  formatMoney,
  formatWallDate,
  formatWallTime,
} from "@/lib/utils/format";
import { idleState } from "@/lib/utils/result";
import {
  cancelDateAction,
  deleteDatePlanAction,
  duplicateDateAction,
  finalizePlanAction,
} from "@/server/actions/plan";
import type { PlanDateDTO } from "@/server/services/plan-service";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}

export function ReviewStep({ plan }: { plan: PlanDateDTO }) {
  const confirm = useConfirm();
  const [finalizeState, finalize] = useActionState(finalizePlanAction, idleState);
  const [, duplicate] = useActionState(duplicateDateAction, idleState);
  const [, cancel] = useActionState(cancelDateAction, idleState);
  const [, remove] = useActionState(deleteDatePlanAction, idleState);

  const ready = Boolean(plan.title.trim() && plan.date);
  const isDraft = plan.status === DateStatus.DRAFT;

  const budget =
    plan.budgetMinCents != null || plan.budgetMaxCents != null
      ? `${formatMoney(plan.budgetMinCents ?? 0, plan.currency)} – ${formatMoney(plan.budgetMaxCents ?? plan.budgetMinCents ?? 0, plan.currency)}`
      : plan.expectedTotalCents != null
        ? formatMoney(plan.expectedTotalCents, plan.currency)
        : "Not set";

  const withConfirm =
    (
      action: (fd: FormData) => void,
      opts: { title: string; description: string; confirmLabel: string },
    ) =>
    async () => {
      const ok = await confirm({ ...opts, tone: "danger" });
      if (!ok) return;
      const fd = new FormData();
      fd.set("dateId", plan.id);
      action(fd);
    };

  return (
    <div className="space-y-6">
      <PlanStepper dateId={plan.id} current="review" />

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-medium text-ink">Ready?</h1>
        <p className="text-sm text-muted">Give it one last look, then make it a plan.</p>
      </div>

      <FormFeedback state={finalizeState} />
      {!ready ? (
        <Alert tone="warning">Add a title and a date on step 1 before you save the plan.</Alert>
      ) : null}

      <div className="divide-y divide-line rounded-xl border border-line bg-surface px-4">
        <Line label="Title">{plan.title || "Untitled plan"}</Line>
        <Line label="Date">{plan.date ? formatWallDate(plan.date) : "Not set"}</Line>
        <Line label="Time">
          {plan.startTime
            ? `${formatWallTime(plan.startTime)}${plan.endTime ? ` – ${formatWallTime(plan.endTime)}` : ""}`
            : "Not set"}
        </Line>
        <Line label="Place">{plan.place?.name ?? "Not set"}</Line>
        <Line label="Budget">{budget}</Line>
      </div>

      {plan.activities.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">The plan</p>
          <Timeline
            activities={plan.activities}
            startIso={plan.plannedStartIso}
            currency={plan.currency}
          />
        </div>
      ) : null}

      <form action={finalize}>
        <input type="hidden" name="dateId" value={plan.id} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LinkButton href={planStepHref(plan.id, "activities")} variant="ghost">
            Back
          </LinkButton>
          <div className="flex gap-2">
            <LinkButton href="/plan" variant="ghost">
              Save as draft
            </LinkButton>
            <SubmitButton disabled={!ready} pendingText="Saving…">
              Save the plan
            </SubmitButton>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        <button
          type="button"
          onClick={() => {
            const fd = new FormData();
            fd.set("dateId", plan.id);
            duplicate(fd);
          }}
          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
        >
          <Icon name="copy" size="sm" />
          Duplicate
        </button>
        {!isDraft ? (
          <button
            type="button"
            onClick={withConfirm(cancel, {
              title: "Cancel this date?",
              description: "It stays in your history, marked cancelled.",
              confirmLabel: "Cancel date",
            })}
            className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-error"
          >
            <Icon name="x" size="sm" />
            Cancel date
          </button>
        ) : null}
        <button
          type="button"
          onClick={withConfirm(remove, {
            title: isDraft ? "Delete this draft?" : "Delete this date?",
            description: "This can't be undone.",
            confirmLabel: "Delete",
          })}
          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-error"
        >
          <Icon name="trash" size="sm" />
          {isDraft ? "Delete draft" : "Delete"}
        </button>
      </div>
    </div>
  );
}
