import { describe, expect, it } from "vitest";

import { buildReviewComparison, revisitCompatibility } from "@/lib/review/comparison";

const CATS = [
  { id: "food", label: "Food" },
  { id: "fun", label: "Fun" },
  { id: "value", label: "Value" },
];

describe("buildReviewComparison — the combined couple score", () => {
  it("couple score is exactly (yourOverall + partnerOverall) / 2, rounded once", () => {
    const c = buildReviewComparison({
      categories: CATS,
      youScores: { food: 8, fun: 9, value: 7 },
      partnerScores: { food: 7, fun: 8, value: 6 },
      youOverall: 9,
      partnerOverall: 8,
      partnerName: "Sam",
    });
    expect(c.coupleScore).toBe(8.5);
  });

  it("uses a consistent half-up rounding, no hidden weighting", () => {
    const c = buildReviewComparison({
      categories: CATS,
      youScores: {},
      partnerScores: {},
      youOverall: 8,
      partnerOverall: 7,
      partnerName: "Sam",
    });
    expect(c.coupleScore).toBe(7.5);
    // categoryAverage is separate + informational, not the couple score
    expect(c.categoryAverage).toBeNull();
  });

  it("per-category combined is the mean of the two, and delta is you − partner", () => {
    const c = buildReviewComparison({
      categories: CATS,
      youScores: { food: 9, fun: 6 },
      partnerScores: { food: 6, fun: 6 },
      youOverall: 8,
      partnerOverall: 6,
      partnerName: "Sam",
    });
    const food = c.categories.find((x) => x.id === "food")!;
    expect(food.combined).toBe(7.5);
    expect(food.delta).toBe(3);
    const value = c.categories.find((x) => x.id === "value")!;
    expect(value.combined).toBeNull(); // neither rated it
  });

  it("falls back to the one score present when only one side rated a category", () => {
    const c = buildReviewComparison({
      categories: CATS,
      youScores: { food: 9 },
      partnerScores: {},
      youOverall: null,
      partnerOverall: null,
      partnerName: "Sam",
    });
    expect(c.categories.find((x) => x.id === "food")!.combined).toBe(9);
    expect(c.coupleScore).toBeNull();
  });

  it("agreement insights are positive/neutral only — never framed as a problem", () => {
    const c = buildReviewComparison({
      categories: CATS,
      youScores: { food: 9, fun: 9, value: 3 },
      partnerScores: { food: 9, fun: 4, value: 3 },
      youOverall: 8,
      partnerOverall: 6,
      partnerName: "Sam",
    });
    const text = c.insights.map((i) => i.text.toLowerCase()).join(" ");
    expect(text).not.toMatch(/worse|bad|problem|argue|wrong|disagree/);
  });
});

describe("revisitCompatibility", () => {
  it("returns null until both people have made a call", () => {
    expect(revisitCompatibility("DEFINITELY", null)).toBeNull();
    expect(revisitCompatibility(null, "MAYBE")).toBeNull();
  });
  it("both keen → strong", () => {
    expect(revisitCompatibility("DEFINITELY", "DEFINITELY")?.level).toBe("strong");
  });
  it("opposite calls → a lower-key, neutral level (never negative language)", () => {
    const r = revisitCompatibility("DEFINITELY", "NEVER_AGAIN");
    expect(r).not.toBeNull();
    expect(["different", "mixed"]).toContain(r?.level);
    expect(r?.blurb.toLowerCase()).not.toMatch(/bad|wrong|problem/);
  });
});
