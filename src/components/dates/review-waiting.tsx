"use client";

import { startTransition, useActionState } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { REFLECTION_PROMPTS } from "@/lib/review/reflection-prompts";
import { REVIEW_REVISIT_META } from "@/lib/review/revisit";
import { scoreLabel } from "@/lib/review/scale";
import { idleState } from "@/lib/utils/result";
import { deleteReviewAction, reopenReviewAction } from "@/server/actions/post-date";
import type { ReviewContext } from "@/server/services/review-service";

export function ReviewWaiting({ ctx }: { ctx: ReviewContext }) {
  const confirm = useConfirm();
  const [reopenState, reopenAction] = useActionState(reopenReviewAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteReviewAction, idleState);
  const my = ctx.myReview;

  const discard = async () => {
    const ok = await confirm({
      title: "Withdraw your review?",
      description: "Your submitted side is removed. You can write it again before the reveal.",
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("dateId", ctx.dateId);
    startTransition(() => deleteAction(fd));
  };

  const reopen = () => {
    const fd = new FormData();
    fd.set("dateId", ctx.dateId);
    startTransition(() => reopenAction(fd));
  };

  return (
    <div className="space-y-6">
      <div className="anim-rise rounded-2xl border border-success/25 bg-success-tint/50 p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success text-primary-fg">
          <Icon name="check" size={22} />
        </span>
        <h2 className="mt-3 font-display text-xl font-medium text-ink">Your side is saved.</h2>
        <p className="mt-1 text-sm text-muted">
          {ctx.hasPartner
            ? `We're waiting for ${ctx.partnerName}'s side of the story. When you've both submitted, the two reviews unlock together.`
            : "It's saved to this date."}
        </p>
      </div>

      <FormFeedback state={reopenState.status !== "idle" ? reopenState : deleteState} />

      {my ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">What you submitted</p>
          <dl className="space-y-1.5 text-sm">
            <Row label="Overall">
              {my.overallRating != null
                ? `${my.overallRating} · ${scoreLabel(my.overallRating)}`
                : "—"}
            </Row>
            {ctx.categories.map((c) => (
              <Row key={c.id} label={c.label}>
                {my.scores[c.id] != null
                  ? `${my.scores[c.id]} · ${scoreLabel(my.scores[c.id])}`
                  : "skipped"}
              </Row>
            ))}
            <Row label="Go again?">
              {my.personalRevisit ? REVIEW_REVISIT_META[my.personalRevisit].label : "—"}
            </Row>
          </dl>
          {REFLECTION_PROMPTS.some((p) => my[p.field]) ? (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              {REFLECTION_PROMPTS.map((p) =>
                my[p.field] ? (
                  <div key={p.key}>
                    <p className="text-xs font-medium text-muted">{p.question}</p>
                    <p className="text-sm text-ink">{my[p.field]}</p>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {ctx.editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={discard}>
            Withdraw
          </Button>
          <Button type="button" variant="secondary" onClick={reopen}>
            Edit my side
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
