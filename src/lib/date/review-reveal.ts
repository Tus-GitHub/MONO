/**
 * The blind-review state machine — pure. The single rule: neither person sees the other's
 * scores until *both* have submitted. A solo couple (partner not joined) reveals on submit.
 */

import { averageScore } from "@/lib/review/scale";

type ReviewSubmission = { authorId: string; submittedAt: Date | string | null };

/** Shared reads never include drafts, former members, or a single partner's hidden score. */
export function sharedReviews<T extends ReviewSubmission>(
  reviews: readonly T[],
  activeMemberIds: readonly string[],
): T[] {
  const members = new Set(activeMemberIds);
  if (members.size === 0) return [];
  const submitted = reviews.filter((review) => members.has(review.authorId) && review.submittedAt != null);
  if (new Set(submitted.map((review) => review.authorId)).size !== members.size) return [];
  return submitted;
}

/** A viewer can always retrieve their own work; partner content requires the shared reveal. */
export function reviewsForViewer<T extends ReviewSubmission>(
  reviews: readonly T[],
  viewerId: string,
  activeMemberIds: readonly string[],
): T[] {
  const shared = new Set(sharedReviews(reviews, activeMemberIds));
  return reviews.filter((review) => review.authorId === viewerId || shared.has(review));
}

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

/** Authors can edit shared reviews; saving keeps the submitted review visible. */
export function isReviewEditable(stage: ReviewStage): boolean {
  return ["none", "draft", "submitted", "revealed"].includes(stage);
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
