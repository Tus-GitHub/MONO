"use client";

import { useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils/cn";

type RatingSize = "sm" | "md" | "lg";
type RatingGlyph = "star" | "heart";

const PX: Record<RatingSize, number> = { sm: 18, md: 24, lg: 32 };

const SHAPES: Record<RatingGlyph, string> = {
  star: "M12 3.6l2.6 5.28 5.82.85-4.21 4.1.99 5.8L12 17.9l-5.2 2.73.99-5.8-4.21-4.1 5.82-.85z",
  heart:
    "M12 19.6S4 14.6 4 9.3A4.2 4.2 0 0 1 8.2 5.1c1.9 0 3.1 1 3.8 2.1C12.7 6.1 13.9 5.1 15.8 5.1A4.2 4.2 0 0 1 20 9.3c0 5.3-8 10.3-8 10.3Z",
};

interface RatingProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  max?: number;
  readOnly?: boolean;
  size?: RatingSize;
  glyph?: RatingGlyph;
  name?: string;
  label?: string;
  allowClear?: boolean;
  className?: string;
}

/** Accessible star/heart rating. Keyboard: arrows adjust, Home/End jump. */
export function Rating({
  value,
  defaultValue = 0,
  onChange,
  max = 5,
  readOnly = false,
  size = "md",
  glyph = "star",
  name,
  label = "Rating",
  allowClear = true,
  className,
}: RatingProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const [popped, setPopped] = useState<number | null>(null);
  const current = isControlled ? (value ?? 0) : internal;
  const shown = hover ?? current;
  const px = PX[size];

  const commit = (next: number) => {
    if (readOnly) return;
    const resolved = allowClear && next === current ? 0 : next;
    if (!isControlled) setInternal(resolved);
    onChange?.(resolved);
    setPopped(resolved);
    window.setTimeout(() => setPopped(null), 280);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const map: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      Home: 0,
      End: max,
    };
    if (!(event.key in map)) return;
    event.preventDefault();
    commit(Math.min(max, Math.max(0, map[event.key])));
  };

  return (
    <div
      role={readOnly ? "img" : "radiogroup"}
      aria-label={readOnly ? `${label}: ${current} of ${max}` : label}
      aria-readonly={readOnly || undefined}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHover(null)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md text-rating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        readOnly && "pointer-events-none",
        className,
      )}
    >
      {Array.from({ length: max }).map((_, index) => {
        const unit = index + 1;
        const filled = unit <= shown;
        return (
          <button
            key={unit}
            type="button"
            role={readOnly ? undefined : "radio"}
            aria-checked={readOnly ? undefined : unit === current}
            aria-label={`${unit} ${unit === 1 ? "point" : "points"}`}
            tabIndex={-1}
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(unit)}
            onFocus={() => !readOnly && setHover(unit)}
            onBlur={() => setHover(null)}
            onClick={() => commit(unit)}
            className={cn(
              "grid place-items-center rounded transition-transform duration-fast",
              !readOnly && "hover:scale-110",
              popped === unit && "anim-pop",
            )}
          >
            <svg
              width={px}
              height={px}
              viewBox="0 0 24 24"
              className={filled ? "text-rating" : "text-rating-track"}
              fill={filled ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={filled ? 0 : 1.6}
              strokeLinejoin="round"
            >
              <path d={SHAPES[glyph]} />
            </svg>
          </button>
        );
      })}
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </div>
  );
}
