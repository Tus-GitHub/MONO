import { describe, expect, it } from "vitest";

import {
  averageScore,
  mean,
  round1,
  scoreLabel,
  scorePercent,
  scoreTone,
  suggestedOverall,
} from "@/lib/review/scale";

describe("round1 / mean / averageScore", () => {
  it("round1 keeps one decimal", () => {
    expect(round1(7.549)).toBe(7.5);
    expect(round1(7.55)).toBe(7.6);
    expect(round1(8)).toBe(8);
  });

  it("mean is a plain average, null when empty", () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4])).toBe(3);
    expect(mean([1, 2, 4])).toBeCloseTo(2.3333, 3);
  });

  it("averageScore = rounded mean", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([8, 7])).toBe(7.5);
    expect(averageScore([9, 9, 8])).toBe(8.7);
  });
});

describe("suggestedOverall", () => {
  it("is the rounded average of valid category scores", () => {
    expect(suggestedOverall([8, 7, 9])).toBe(8);
    expect(suggestedOverall([8, 7])).toBe(8); // 7.5 → 8 (Math.round half-up)
  });
  it("ignores out-of-range values and empty input", () => {
    expect(suggestedOverall([])).toBeNull();
    expect(suggestedOverall([0, 11, 5])).toBe(5);
  });
});

describe("labels & tone (a number never stands alone)", () => {
  it("scoreLabel clamps and words the score", () => {
    expect(scoreLabel(null)).toBe("Not rated");
    expect(scoreLabel(1)).toBe("Rough");
    expect(scoreLabel(10)).toBe("Unforgettable");
    expect(scoreLabel(7.4)).toBe("Good");
    expect(scoreLabel(99)).toBe("Unforgettable");
  });
  it("scoreTone buckets low/mid/high without relying on colour alone (the number carries it)", () => {
    expect(scoreTone(null)).toBe("mid");
    expect(scoreTone(3)).toBe("low");
    expect(scoreTone(6)).toBe("mid");
    expect(scoreTone(9)).toBe("high");
  });
  it("scorePercent maps 1..10 to 0..100", () => {
    expect(scorePercent(1)).toBe(0);
    expect(scorePercent(10)).toBe(100);
    expect(scorePercent(5.5)).toBe(50);
    expect(scorePercent(null)).toBe(0);
  });
});
