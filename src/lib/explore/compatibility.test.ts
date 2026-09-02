import { describe, expect, it } from "vitest";

import { coupleMatch } from "@/lib/explore/compatibility";

const members = (a: number, aCount: number, b: number, bCount: number) => [
  { memberId: "u1", memberName: "You", avg: a, count: aCount },
  { memberId: "u2", memberName: "Sam", avg: b, count: bCount },
];

describe("coupleMatch — private, deterministic Couple Match %", () => {
  it("is null (never invented) when there is no history", () => {
    const m = coupleMatch({
      categoryLabel: "activity",
      memberStats: members(0, 0, 0, 0),
      coupleAvgForCategory: null,
    });
    expect(m.percent).toBeNull();
    expect(m.band).toBe("unknown");
  });

  it("is deterministic — same input, same output", () => {
    const input = {
      categoryLabel: "café",
      memberStats: members(8, 4, 7, 3),
      coupleAvgForCategory: 7.5,
    };
    expect(coupleMatch(input)).toEqual(coupleMatch(input));
  });

  it("rewards a high, agreed rating with a high band and a positive reason", () => {
    const m = coupleMatch({
      categoryLabel: "activity",
      memberStats: members(9, 5, 9, 5),
      coupleAvgForCategory: 9,
    });
    expect(m.percent).toBeGreaterThanOrEqual(80);
    expect(m.band).toBe("high");
    expect(m.reason.toLowerCase()).toMatch(/both|same page|highly/);
  });

  it("pins a revisit-YES place to a high score", () => {
    const m = coupleMatch({
      categoryLabel: "dinner",
      memberStats: members(3, 2, 3, 2),
      coupleAvgForCategory: 3,
      revisitYes: true,
    });
    expect(m.percent).toBe(94);
    expect(m.reason.toLowerCase()).toContain("come back");
  });

  it("stays within 40–98 and never negative", () => {
    for (const [a, b] of [
      [1, 1],
      [10, 1],
      [5, 6],
      [10, 10],
    ] as const) {
      const m = coupleMatch({
        categoryLabel: "outdoor",
        memberStats: members(a, 4, b, 4),
        coupleAvgForCategory: (a + b) / 2,
      });
      expect(m.percent).not.toBeNull();
      expect(m.percent as number).toBeGreaterThanOrEqual(40);
      expect(m.percent as number).toBeLessThanOrEqual(98);
    }
  });
});
