"use client";

import { useEffect, useState } from "react";
import type { ReviewRevisit } from "@prisma/client";

import { Avatar } from "@/components/ui/avatar";
import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type {
  AgreementInsight,
  CategoryComparison,
  ReviewComparison,
  RevisitCompatibility,
} from "@/lib/review/comparison";
import { REFLECTION_PROMPTS } from "@/lib/review/reflection-prompts";
import { REVIEW_REVISIT_META } from "@/lib/review/revisit";
import { scoreLabel, scorePercent, scoreTone } from "@/lib/review/scale";
import { cn } from "@/lib/utils/cn";

interface Side {
  name: string;
  avatar: string | null;
  overall: number | null;
  revisit: ReviewRevisit | null;
  revisitNote: string | null;
  reflections: {
    loved: string | null;
    better: string | null;
    remember: string | null;
    unexpected: string | null;
  };
}

interface Props {
  dateId: string;
  partnerLabel: string;
  you: Side;
  partner: Side;
  comparison: ReviewComparison;
  revisitCompat: RevisitCompatibility | null;
}

const TONE_TINT = {
  high: "bg-success-tint text-success",
  mid: "bg-rating/15 text-rating",
  low: "bg-warning-tint text-warning",
} as const;

export function ReviewReveal({
  dateId,
  partnerLabel,
  you,
  partner,
  comparison,
  revisitCompat,
}: Props) {
  const storageKey = `mono:review-revealed:${dateId}`;
  const [open, setOpen] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "1";
    } catch {
      /* private mode — treat as unseen */
    }
    if (seen) queueMicrotask(() => setOpen(true));
  }, [storageKey]);

  const reveal = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setJustRevealed(true);
    setOpen(true);
  };

  const stagger = (i: number) =>
    justRevealed ? { animationDelay: `${i * 90}ms` } : undefined;
  const riseClass = justRevealed ? "anim-rise" : undefined;

  return (
    <section className="space-y-3" aria-label="Combined review">
      {/* --- Reveal gate --- */}
      <div
        hidden={open}
        className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm"
      >
        <div className="mx-auto w-fit">
          <CoupleAvatar
            members={[
              { name: you.name, src: you.avatar },
              { name: partner.name, src: partner.avatar },
            ]}
            size="md"
          />
        </div>
        <h2 className="mt-3 font-display text-xl font-medium text-ink">You both reviewed it.</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          Written apart, kept private until now. Ready to see how the two of you saw this date?
        </p>
        <Button className="mt-4" onClick={reveal} leadingIcon={<Icon name="sparkles" size="sm" />}>
          Reveal the comparison
        </Button>
      </div>

      {/* --- The comparison --- */}
      <div hidden={!open} className="space-y-3">
        <CoupleScoreHero
          comparison={comparison}
          youOverall={you.overall}
          partnerOverall={partner.overall}
          partnerLabel={partnerLabel}
          className={riseClass}
          style={stagger(0)}
        />

        <div
          className={cn("rounded-xl border border-line bg-surface p-5 shadow-sm", riseClass)}
          style={stagger(1)}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-medium text-ink">Category by category</h3>
            <span className="flex items-center gap-3 text-2xs text-muted">
              <LegendDot className="bg-primary" /> You
              <LegendDot className="bg-accent" /> {partnerLabel}
            </span>
          </div>
          <ul className="space-y-4">
            {comparison.categories.map((category) => (
              <li key={category.id}>
                <CategoryTrack category={category} partnerLabel={partnerLabel} />
              </li>
            ))}
          </ul>
        </div>

        {comparison.insights.length > 0 ? (
          <div
            className={cn("rounded-xl border border-line bg-surface p-5 shadow-sm", riseClass)}
            style={stagger(2)}
          >
            <h3 className="font-display text-base font-medium text-ink">What stands out</h3>
            <ul className="mt-3 space-y-2">
              {comparison.insights.map((insight, index) => (
                <InsightRow key={index} insight={insight} />
              ))}
            </ul>
          </div>
        ) : null}

        {revisitCompat ? (
          <div
            className={cn("rounded-xl border border-line bg-surface p-5 shadow-sm", riseClass)}
            style={stagger(3)}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
                  TONE_TINT[revisitCompat.tone],
                )}
              >
                <Icon name="refresh" size="sm" />
              </span>
              <div className="flex-1">
                <p className="font-display text-base font-medium text-ink">
                  {revisitCompat.label}
                </p>
                <p className="mt-0.5 text-sm text-muted">{revisitCompat.blurb}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              <RevisitSide label="You" side={you} />
              <RevisitSide label={partnerLabel} side={partner} />
            </div>
          </div>
        ) : null}

        <ReflectionCompare you={you} partner={partner} partnerLabel={partnerLabel} className={riseClass} style={stagger(4)} />
      </div>
    </section>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={cn("inline-block size-2 rounded-full", className)} />;
}

function CoupleScoreHero({
  comparison,
  youOverall,
  partnerOverall,
  partnerLabel,
  className,
  style,
}: {
  comparison: ReviewComparison;
  youOverall: number | null;
  partnerOverall: number | null;
  partnerLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const score = comparison.coupleScore;
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-linear-to-br from-primary-tint/60 via-surface to-accent-tint/50 p-6 text-center shadow-sm",
        className,
      )}
      style={style}
    >
      <p className="text-2xs font-medium uppercase tracking-wide text-muted">Combined couple score</p>
      <p className="mt-1 font-display text-5xl font-semibold text-ink">
        {score != null ? score.toFixed(1) : "—"}
        <span className="text-2xl font-medium text-muted">/10</span>
      </p>
      {score != null ? (
        <p className="mt-1 text-sm font-medium text-ink">{scoreLabel(score)}</p>
      ) : null}
      {youOverall != null && partnerOverall != null ? (
        <p className="mt-2 text-xs text-muted">
          ({youOverall} + {partnerOverall}) ÷ 2 — you rated it {youOverall}, {partnerLabel}{" "}
          rated it {partnerOverall}
        </p>
      ) : null}
    </div>
  );
}

function CategoryTrack({
  category,
  partnerLabel,
}: {
  category: CategoryComparison;
  partnerLabel: string;
}) {
  const { you, partner, combined, delta } = category;
  const agreement =
    delta == null ? null : Math.abs(delta) <= 1 ? "in step" : Math.abs(delta) >= 4 ? `${Math.abs(delta)} apart` : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{category.label}</span>
        <span className="flex items-center gap-2">
          {agreement ? (
            <span
              className={cn(
                "text-2xs font-medium",
                agreement === "in step" ? "text-success" : "text-muted",
              )}
            >
              {agreement}
            </span>
          ) : null}
          {combined != null ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                TONE_TINT[scoreTone(combined)],
              )}
            >
              {combined.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-faint">not both rated</span>
          )}
        </span>
      </div>

      <div className="relative mt-2.5 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        {you != null && partner != null ? (
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-line-strong"
            style={{
              left: `${Math.min(scorePercent(you), scorePercent(partner))}%`,
              width: `${Math.abs(scorePercent(you) - scorePercent(partner))}%`,
            }}
          />
        ) : null}
        {you != null ? <Dot value={you} className="bg-primary" title={`You: ${you}`} /> : null}
        {partner != null ? (
          <Dot value={partner} className="bg-accent" title={`${partnerLabel}: ${partner}`} />
        ) : null}
      </div>

      <div className="mt-1.5 flex gap-4 text-2xs text-muted">
        <span>
          <span className="font-medium text-ink">You</span> {you ?? "–"}
        </span>
        <span>
          <span className="font-medium text-ink">{partnerLabel}</span> {partner ?? "–"}
        </span>
      </div>
    </div>
  );
}

function Dot({
  value,
  className,
  title,
}: {
  value: number;
  className: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-2xs font-semibold text-white shadow-sm ring-2 ring-surface",
        className,
      )}
      style={{ left: `${scorePercent(value)}%` }}
    >
      {value}
    </span>
  );
}

const INSIGHT_ICON: Record<AgreementInsight["kind"], "sparkles" | "heart" | "arrowRight" | "info"> = {
  top: "sparkles",
  agreement: "heart",
  lean: "arrowRight",
  low: "info",
};

function InsightRow({ insight }: { insight: AgreementInsight }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink">
      <Icon
        name={INSIGHT_ICON[insight.kind]}
        size={14}
        className="mt-0.5 shrink-0 text-primary"
      />
      {insight.text}
    </li>
  );
}

function RevisitSide({ label, side }: { label: string; side: Side }) {
  const meta = side.revisit ? REVIEW_REVISIT_META[side.revisit] : null;
  return (
    <div className="rounded-lg border border-line bg-paper/60 px-3 py-2">
      <p className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="text-sm font-medium text-ink">{meta?.label ?? "—"}</p>
      {side.revisitNote ? (
        <p className="mt-0.5 text-xs text-muted">{side.revisitNote}</p>
      ) : null}
    </div>
  );
}

function ReflectionCompare({
  you,
  partner,
  partnerLabel,
  className,
  style,
}: {
  you: Side;
  partner: Side;
  partnerLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const rows = REFLECTION_PROMPTS.map((prompt) => {
    const key = prompt.field.replace("Text", "") as keyof Side["reflections"];
    return { key: prompt.key, question: prompt.question, a: you.reflections[key], b: partner.reflections[key] };
  }).filter((row) => row.a || row.b);

  if (rows.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5 shadow-sm", className)} style={style}>
      <h3 className="font-display text-base font-medium text-ink">In your own words</h3>
      <div className="mt-3 space-y-4">
        {rows.map((row) => (
          <div key={row.key}>
            <p className="text-xs font-medium uppercase tracking-wide text-faint">{row.question}</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <p className="text-sm text-ink">
                <span className="mr-1 inline-flex items-center gap-1 align-middle">
                  <Avatar name={you.name} src={you.avatar} size="xs" />
                  <span className="text-muted">You</span>
                </span>
                {row.a || <span className="text-faint">—</span>}
              </p>
              <p className="text-sm text-ink">
                <span className="mr-1 inline-flex items-center gap-1 align-middle">
                  <Avatar name={partner.name} src={partner.avatar} size="xs" />
                  <span className="text-muted">{partnerLabel}</span>
                </span>
                {row.b || <span className="text-faint">—</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
