/**
 * The blind-review state machine — pure. The single rule: neither person sees the other's
 * scores until *both* have submitted. A solo couple (partner not joined) reveals on submit.
 */

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
