import { describe, expect, it } from "vitest";

import {
  dateCoupleScore,
  isRevealed,
  isReviewEditable,
  reviewStage,
  sharedReviews,
  reviewsForViewer,
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

describe("review visibility across exports and aggregates", () => {
  const first = { authorId: "a", submittedAt: new Date(), secret: "a-only" };
  const second = { authorId: "b", submittedAt: null, secret: "b-only" };
  it("returns only the viewer's own work until both partners submit", () => {
    expect(sharedReviews([first, second], ["a", "b"])).toEqual([]);
    expect(reviewsForViewer([first, second], "b", ["a", "b"])).toEqual([second]);
  });
  it("reveals submitted active-member reviews and excludes former members", () => {
    const submitted = { ...second, submittedAt: new Date() };
    const former = { authorId: "former", submittedAt: new Date(), secret: "former-only" };
    expect(sharedReviews([first, submitted, former], ["a", "b"])).toEqual([first, submitted]);
    expect(reviewsForViewer([first, submitted, former], "b", ["a", "b"])).toEqual([first, submitted]);
  });
  it("reveals a solo member's submission, but never a draft or an unknown membership set", () => {
    expect(sharedReviews([first, second], ["a"])).toEqual([first]);
    expect(sharedReviews([second], ["b"])).toEqual([]);
    expect(sharedReviews([first], [])).toEqual([]);
  });
  it("duplicate submissions cannot stand in for the partner", () => {
    expect(sharedReviews([first, { ...first }], ["a", "b"])).toEqual([]);
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
  it("allows authors to edit before and after the reveal", () => {
    expect(isReviewEditable("none")).toBe(true);
    expect(isReviewEditable("draft")).toBe(true);
    expect(isReviewEditable("submitted")).toBe(true);
    expect(isReviewEditable("revealed")).toBe(true);
  });
});
