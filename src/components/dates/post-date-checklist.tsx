import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import type { Pipeline, PipelineStepKey } from "@/lib/date/pipeline";
import { cn } from "@/lib/utils/cn";

const ANCHOR: Partial<Record<PipelineStepKey, string>> = {
  photos: "#photos",
  bestPhoto: "#photos",
  revisit: "#again",
};

export function PostDateChecklist({ pipeline }: { pipeline: Pipeline }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium text-ink">After the date</h2>
        <span className="text-xs font-medium text-muted">
          {pipeline.doneCount} of {pipeline.total}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        No rush — pick these up whenever. Nothing here locks the date.
      </p>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-success transition-[width] duration-slow"
          style={{ width: `${Math.round((pipeline.doneCount / Math.max(1, pipeline.total)) * 100)}%` }}
        />
      </div>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {pipeline.steps.map((step) => {
          const href = step.to ?? ANCHOR[step.key] ?? null;
          const body = (
            <div className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  step.done
                    ? "border-success bg-success-tint text-success"
                    : step.waiting
                      ? "border-line text-faint"
                      : "border-line-strong text-muted",
                )}
              >
                {step.done ? (
                  <Icon name="check" size={13} />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    step.done ? "text-muted" : "text-ink",
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-xs text-faint">{step.hint}</span>
              </span>
              {step.waiting ? (
                <span className="shrink-0 text-2xs font-medium uppercase tracking-wide text-faint">
                  Waiting
                </span>
              ) : href ? (
                <Icon name="chevronRight" size="sm" className="shrink-0 text-faint" />
              ) : null}
            </div>
          );

          if (href && !step.waiting) {
            return (
              <li key={step.key}>
                <Link
                  href={href}
                  className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-paper/70"
                >
                  {body}
                </Link>
              </li>
            );
          }
          return <li key={step.key}>{body}</li>;
        })}
      </ul>
    </section>
  );
}
