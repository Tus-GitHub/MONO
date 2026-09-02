/**
 * The blind-review state machine — pure. The single rule: neither person sees the other's
 * scores until *both* have submitted. A solo couple (partner not joined) reveals on submit.
 */

import { averageScore } from "@/lib/review/scale";

export type ReviewStage =
  | "none" // I haven't started
  | "draft" // I have a private draft, not submitted
  | "submitted" // I submitted — waiting on my partner
  | "revealed"; // both submitted — scores are visible

export function reviewStage(input: {
  mineExists: boolean;
  mineSubmitted: boolean;
  partnerSubmitted: boolean;
  hasPartner: boolean;
}): ReviewStage {
  if (input.mineSubmitted) {
    return input.partnerSubmitted || !input.hasPartner ? "revealed" : "submitted";
  }
  return input.mineExists ? "draft" : "none";
}

/** A review can be changed right up until the reveal — after that it's locked. */
export function isReviewEditable(stage: ReviewStage): boolean {
  return stage !== "revealed";
}

/**
 * The reveal condition expressed as a plain boolean over submitted-review counts. Equivalent to
 * `reviewStage(...) === "revealed"` for the common case where you only need yes/no. Use this so
 * every aggregate ("couple average score", stats) gates identically.
 */
export function isRevealed(submittedCount: number, hasPartner: boolean): boolean {
  return hasPartner ? submittedCount >= 2 : submittedCount >= 1;
}

/**
 * A single date's couple score: the average of both partners' submitted overall ratings, but
 * only once the date is revealed. `null` before that (a hidden score is never surfaced).
 */
export function dateCoupleScore(
  submittedOveralls: number[],
  revealed: boolean,
): number | null {
  return revealed ? averageScore(submittedOveralls) : null;
}
