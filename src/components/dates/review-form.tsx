"use client";

import { startTransition, useActionState, useState } from "react";
import { ReviewRevisit } from "@prisma/client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { Photo } from "@/components/ui/photo";
import { ScoreScale } from "@/components/ui/score-scale";
import { SubmitButton } from "@/components/ui/submit-button";
import { UnsavedGuard } from "@/components/system/unsaved-guard";
import { REFLECTION_PROMPTS } from "@/lib/review/reflection-prompts";
import { REVIEW_REVISIT_META, REVIEW_REVISIT_ORDER } from "@/lib/review/revisit";
import { scoreLabel, suggestedOverall } from "@/lib/review/scale";
import { formatWallDate } from "@/lib/utils/format";
import { idleState, type ActionState } from "@/lib/utils/result";
import { cn } from "@/lib/utils/cn";
import {
  deleteReviewAction,
  saveReviewDraftAction,
  submitReviewAction,
} from "@/server/actions/post-date";
import type { ReviewContext } from "@/server/services/review-service";

type Texts = Record<(typeof REFLECTION_PROMPTS)[number]["field"], string>;

export function ReviewForm({ ctx }: { ctx: ReviewContext }) {
  const confirm = useConfirm();
  const [draftState, draftAction] = useActionState(saveReviewDraftAction, idleState);
  const [submitState, submitAction] = useActionState(submitReviewAction, idleState);
  const [, deleteAction] = useActionState(deleteReviewAction, idleState);

  const state: ActionState = submitState.status !== "idle" ? submitState : draftState;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const my = ctx.myReview;
  const [scores, setScores] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(ctx.categories.map((c) => [c.id, my?.scores[c.id] ?? null])),
  );
  const [overall, setOverall] = useState<number | null>(my?.overallRating ?? null);
  const [overallTouched, setOverallTouched] = useState(my?.overallRating != null);
  const [revisit, setRevisit] = useState<ReviewRevisit | null>(my?.personalRevisit ?? null);
  const [revisitNote, setRevisitNote] = useState(my?.personalRevisitNote ?? "");
  const [texts, setTexts] = useState<Texts>(() => ({
    lovedText: my?.lovedText ?? "",
    betterText: my?.betterText ?? "",
    rememberText: my?.rememberText ?? "",
    unexpectedText: my?.unexpectedText ?? "",
  }));

  const scoredValues = Object.values(scores).filter((n): n is number => n != null);
  const suggested = suggestedOverall(scoredValues);
  const effectiveOverall = overallTouched ? overall : suggested;
  const reflectionsWritten = Object.values(texts).filter((t) => t.trim()).length;

  const discard = async () => {
    const ok = await confirm({
      title: "Discard your review?",
      description: "Your draft and any scores are removed. You can start again later.",
      confirmLabel: "Discard",
      tone: "danger",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("dateId", ctx.dateId);
    startTransition(() => deleteAction(fd));
  };

  return (
    <form action={draftAction} className="space-y-7" noValidate>
      <UnsavedGuard />
      <input type="hidden" name="dateId" value={ctx.dateId} />
      <input type="hidden" name="personalRevisitNote" value={revisitNote} />

      {/* Context */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {ctx.cover ? (
          <Photo
            thumbUrl={ctx.cover.thumbUrl}
            displayUrl={ctx.cover.displayUrl}
            blurDataUrl={ctx.cover.blurDataUrl}
            alt=""
            aspect="21 / 9"
            sizes="(min-width: 640px) 36rem, 100vw"
          />
        ) : null}
        <div className="space-y-1 p-4">
          <p className="font-display text-base font-medium text-ink">{ctx.dateTitle}</p>
          <p className="text-sm text-muted">
            {[
              ctx.dateYmd ? formatWallDate(ctx.dateYmd, "medium") : null,
              ctx.placeLabel,
              ctx.placeCategoryLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <FormFeedback state={state} />

      <div className="flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent-tint/40 px-3.5 py-2.5 text-sm text-accent">
        <Icon name="lock" size="sm" className="mt-0.5 shrink-0" />
        <p>
          {ctx.hasPartner
            ? `Only you can see this. Nothing is shared until ${ctx.partnerName} submits their side too.`
            : "Only you can see this."}
        </p>
      </div>

      <div className="space-y-1">
        <h2 className="font-display text-xl font-medium text-ink">How did this date feel to you?</h2>
        <p className="text-sm text-muted">
          Your own take — {ctx.partnerName} writes theirs separately.
        </p>
      </div>

      {/* Category ratings */}
      <fieldset className="space-y-5">
        <legend className="text-sm font-medium text-ink">Rate it, 1 to 10</legend>
        {ctx.categories.map((category) => (
          <div key={category.id}>
            <ScoreScale
              name={`score:${category.id}`}
              label={category.label}
              value={scores[category.id] ?? null}
              onChange={(n) => setScores((s) => ({ ...s, [category.id]: n }))}
            />
            {category.description ? (
              <p className="mt-1 text-xs text-faint">{category.description}</p>
            ) : null}
          </div>
        ))}
      </fieldset>

      {/* Overall */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <ScoreScale
          name="overallRating"
          label="Overall experience"
          value={effectiveOverall}
          suggested={!overallTouched && suggested != null}
          hint="MONO's suggestion"
          onChange={(n) => {
            setOverallTouched(true);
            setOverall(n);
          }}
        />
        <p className="mt-2 text-xs text-muted">
          {suggested != null && !overallTouched
            ? `Suggested from your ratings — change it to whatever feels true.`
            : `Your call. It doesn't have to match the categories.`}
        </p>
        {fieldErrors?.overallRating ? (
          <p className="mt-1 text-xs text-error">{fieldErrors.overallRating[0]}</p>
        ) : null}
      </div>

      {/* Reflection */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-ink">
          A few things to write down{" "}
          <span className="font-normal text-faint">— all optional</span>
        </p>
        {REFLECTION_PROMPTS.map((prompt) => (
          <Field key={prompt.key} label={prompt.question} htmlFor={`r-${prompt.key}`} optional>
            <Textarea
              id={`r-${prompt.key}`}
              name={prompt.field}
              rows={2}
              value={texts[prompt.field]}
              onChange={(e) => setTexts((t) => ({ ...t, [prompt.field]: e.target.value }))}
              placeholder={prompt.placeholder}
            />
          </Field>
        ))}
      </div>

      {/* Revisit */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Would you do this again?</p>
        <input type="hidden" name="personalRevisit" value={revisit ?? ""} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REVIEW_REVISIT_ORDER.map((choice) => {
            const meta = REVIEW_REVISIT_META[choice];
            return (
              <button
                key={choice}
                type="button"
                aria-pressed={revisit === choice}
                onClick={() => setRevisit(revisit === choice ? null : choice)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-center transition-colors",
                  revisit === choice
                    ? "border-primary bg-primary-tint text-primary"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="mt-0.5 block text-2xs">{meta.hint}</span>
              </button>
            );
          })}
        </div>
        {fieldErrors?.personalRevisit ? (
          <p className="text-xs text-error">{fieldErrors.personalRevisit[0]}</p>
        ) : null}
        {revisit ? (
          <Input
            value={revisitNote}
            onChange={(e) => setRevisitNote(e.target.value)}
            placeholder="Why? (optional)"
            aria-label="Revisit reason"
            maxLength={1000}
          />
        ) : null}
      </div>

      {/* Summary before submit */}
      <div className="rounded-xl border border-line bg-paper/60 p-4">
        <p className="mb-2 text-sm font-medium text-ink">Your side, at a glance</p>
        <dl className="space-y-1.5 text-sm">
          <SummaryRow label="Overall">
            {effectiveOverall != null
              ? `${effectiveOverall} · ${scoreLabel(effectiveOverall)}`
              : "not set"}
          </SummaryRow>
          {ctx.categories.map((c) => (
            <SummaryRow key={c.id} label={c.label}>
              {scores[c.id] != null ? `${scores[c.id]} · ${scoreLabel(scores[c.id])}` : "skipped"}
            </SummaryRow>
          ))}
          <SummaryRow label="Go again?">
            {revisit ? REVIEW_REVISIT_META[revisit].label : "not chosen"}
          </SummaryRow>
          <SummaryRow label="Reflections">
            {reflectionsWritten > 0 ? `${reflectionsWritten} of 4 written` : "none written"}
          </SummaryRow>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
        {my ? (
          <Button type="button" variant="ghost" size="sm" onClick={discard}>
            Discard
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save draft
          </SubmitButton>
          <SubmitButton formAction={submitAction} pendingText="Submitting…">
            Submit my side
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
