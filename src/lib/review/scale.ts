/**
 * The 1–10 review scale — pure, shared by the rating control, the summary, and the reveal.
 * Every score gets a plain-language label so a number never stands alone.
 */

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

const LABELS: Record<number, string> = {
  1: "Rough",
  2: "Poor",
  3: "Weak",
  4: "So-so",
  5: "Fine",
  6: "Decent",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Unforgettable",
};

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return "Not rated";
  return LABELS[Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)))] ?? "—";
}

export type ScoreTone = "low" | "mid" | "high";

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score == null) return "mid";
  if (score <= 3) return "low";
  if (score <= 6) return "mid";
  return "high";
}

/** 0–100 for a meter fill. */
export function scorePercent(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.round(((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100);
}

/**
 * A suggested overall from the category scores — the rounded average. Purely a starting point;
 * the person always sets the final number themselves.
 */
export function suggestedOverall(scores: number[]): number | null {
  const real = scores.filter((s) => Number.isFinite(s) && s >= SCORE_MIN && s <= SCORE_MAX);
  if (real.length === 0) return null;
  return Math.round(real.reduce((sum, s) => sum + s, 0) / real.length);
}

/** Round to one decimal place — the house rounding for every score shown. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Plain mean of a list, or `null` when empty. Not rounded. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Average of a set of overall scores, one decimal — used for the combined couple score. */
export function averageScore(scores: number[]): number | null {
  const m = mean(scores);
  return m == null ? null : round1(m);
}
