import { describe, expect, it } from "vitest";

import {
  dateCoupleScore,
  isRevealed,
  isReviewEditable,
  reviewStage,
} from "@/lib/date/review-reveal";

describe("reviewStage — blind until both submit", () => {
  const base = { mineExists: false, mineSubmitted: false, partnerSubmitted: false, hasPartner: true };

  it("nothing started", () => {
    expect(reviewStage(base)).toBe("none");
  });
  it("my private draft is not visible to anyone", () => {
    expect(reviewStage({ ...base, mineExists: true })).toBe("draft");
  });
  it("I submitted but my partner hasn't — still hidden", () => {
    expect(reviewStage({ ...base, mineExists: true, mineSubmitted: true })).toBe("submitted");
  });
  it("both submitted — revealed", () => {
    expect(
      reviewStage({ mineExists: true, mineSubmitted: true, partnerSubmitted: true, hasPartner: true }),
    ).toBe("revealed");
  });
  it("a solo couple reveals on their own submit", () => {
    expect(
      reviewStage({ mineExists: true, mineSubmitted: true, partnerSubmitted: false, hasPartner: false }),
    ).toBe("revealed");
  });
  it("partner submitting first does not reveal my un-submitted side", () => {
    expect(reviewStage({ ...base, partnerSubmitted: true })).toBe("none");
  });
});

describe("isRevealed — the boolean form used by every aggregate", () => {
  it("needs both partners for a two-person couple", () => {
    expect(isRevealed(0, true)).toBe(false);
    expect(isRevealed(1, true)).toBe(false);
    expect(isRevealed(2, true)).toBe(true);
  });
  it("needs one submission for a solo couple", () => {
    expect(isRevealed(0, false)).toBe(false);
    expect(isRevealed(1, false)).toBe(true);
  });
});

describe("dateCoupleScore — never surfaces a hidden score", () => {
  it("is null before reveal even if a score exists", () => {
    expect(dateCoupleScore([8], false)).toBeNull();
  });
  it("is the rounded average of both overalls once revealed", () => {
    expect(dateCoupleScore([8, 7], true)).toBe(7.5);
    expect(dateCoupleScore([9], true)).toBe(9); // solo couple
  });
  it("is null when revealed but no overalls recorded", () => {
    expect(dateCoupleScore([], true)).toBeNull();
  });
});

describe("isReviewEditable", () => {
  it("stays editable until the reveal, then locks", () => {
    expect(isReviewEditable("none")).toBe(true);
    expect(isReviewEditable("draft")).toBe(true);
    expect(isReviewEditable("submitted")).toBe(true);
    expect(isReviewEditable("revealed")).toBe(false);
  });
});
