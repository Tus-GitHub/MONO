"use client";

import { useId, useRef, type KeyboardEvent } from "react";

import { SCORE_MAX, SCORE_MIN, scoreLabel, scoreTone } from "@/lib/review/scale";
import { cn } from "@/lib/utils/cn";

const TONE_FILL: Record<ReturnType<typeof scoreTone>, string> = {
  low: "bg-warning",
  mid: "bg-rating",
  high: "bg-success",
};

interface ScoreScaleProps {
  /** Hidden-input name for form submission; empty string when unset. */
  name?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  /** e.g. "MONO's suggestion" — shown when `value` came from elsewhere and isn't the user's pick. */
  hint?: string;
  /** Dim styling to signal "this is a starting point, not your answer yet". */
  suggested?: boolean;
  className?: string;
}

/**
 * Accessible 1–10 rating. A row of ten tappable cells that fill left-to-right, with the plain
 * word for the score alongside the number. Keyboard: ← → adjust, Home / End jump, Backspace
 * clears. Reports through `onChange` and mirrors into a hidden input for plain form posts.
 */
export function ScoreScale({
  name,
  value,
  onChange,
  label,
  hint,
  suggested = false,
  className,
}: ScoreScaleProps) {
  const groupId = useId();
  const cellsRef = useRef<HTMLDivElement>(null);
  const shown = value ?? 0;

  const commit = (next: number | null) => {
    if (next != null && next === value) onChange(null); // tap the current score again to clear
    else onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = value ?? SCORE_MIN - 1;
    let next: number | null | undefined;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(SCORE_MIN, current - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(SCORE_MAX, (value ?? SCORE_MIN - 1) + 1);
        break;
      case "Home":
        next = SCORE_MIN;
        break;
      case "End":
        next = SCORE_MAX;
        break;
      case "Backspace":
      case "Delete":
        next = null;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(next ?? null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={groupId} className="text-sm font-medium text-ink">
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {value != null ? (
            <>
              <span
                className={cn(
                  "font-semibold",
                  suggested ? "text-faint" : "text-ink",
                )}
              >
                {value}
              </span>{" "}
              · {scoreLabel(value)}
              {suggested && hint ? <span className="text-faint"> · {hint}</span> : null}
            </>
          ) : (
            <span className="text-faint">Not rated</span>
          )}
        </span>
      </div>

      <div
        ref={cellsRef}
        role="slider"
        aria-labelledby={groupId}
        aria-valuemin={SCORE_MIN}
        aria-valuemax={SCORE_MAX}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value != null ? `${value} out of 10 — ${scoreLabel(value)}` : "not rated"}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        {Array.from({ length: SCORE_MAX }, (_, index) => {
          const n = index + 1;
          const filled = n <= shown;
          return (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              aria-label={`${n} — ${scoreLabel(n)}`}
              aria-pressed={value != null && n <= value}
              onClick={() => commit(n)}
              className={cn(
                // 10 across must fit the narrowest phone — a fixed 44px min-width (`.tap`) overflows
                // and clips 9/10. Keep a tall 44px touch target; let width shrink to share the row.
                "h-11 min-w-0 flex-1 rounded-md border text-2xs font-medium transition-[color,background-color,border-color,transform] motion-safe:active:scale-[0.97]",
                filled
                  ? cn(
                      "border-transparent text-white",
                      suggested ? "bg-faint" : TONE_FILL[scoreTone(value)],
                    )
                  : "border-line bg-surface text-faint hover:border-line-strong hover:text-muted",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </div>
  );
}
