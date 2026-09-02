import { describe, expect, it } from "vitest";

import {
  buildCategoryPreferences,
  buildCoupleInsights,
  findPreferenceGaps,
  round1,
  type CategoryScoreRow,
  type InsightInput,
  type MemberRef,
} from "@/lib/couple/insights";

const A: MemberRef = { id: "a", name: "Ana" };
const B: MemberRef = { id: "b", name: "Ben" };

function row(
  dateId: string,
  memberId: string,
  score: number,
  categoryKey = "food",
  categoryLabel = "Food",
  categoryOrder = 0,
): CategoryScoreRow {
  return { dateId, memberId, score, categoryKey, categoryLabel, categoryOrder };
}

describe("round1", () => {
  it("rounds to one decimal, half-up", () => {
    expect(round1(8.449)).toBe(8.4);
    expect(round1(8.45)).toBe(8.5);
    expect(round1(7)).toBe(7);
  });
});

describe("buildCategoryPreferences — category averages", () => {
  it("couple average weights both people equally and needs >= CATEGORY_MIN_SAMPLE distinct dates", () => {
    // one date only -> below the sample threshold -> null, but sampleSize still reported
    const one = buildCategoryPreferences([row("d1", "a", 8), row("d1", "b", 6)], [A, B]);
    expect(one[0].sampleSize).toBe(1);
    expect(one[0].coupleAvg).toBeNull();

    // two distinct dates -> (8 + 6 + 9 + 7) / 4 = 7.5
    const two = buildCategoryPreferences(
      [row("d1", "a", 8), row("d1", "b", 6), row("d2", "a", 9), row("d2", "b", 7)],
      [A, B],
    );
    expect(two[0].sampleSize).toBe(2);
    expect(two[0].coupleAvg).toBe(7.5);
  });

  it("per-member average is gated on that member's own distinct-date count", () => {
    // Ana has 2 dates, Ben has 1 -> Ben's avg is null, Ana's is (8+10)/2 = 9
    const prefs = buildCategoryPreferences(
      [row("d1", "a", 8), row("d2", "a", 10), row("d1", "b", 5)],
      [A, B],
    );
    const ana = prefs[0].perMember.find((m) => m.memberId === "a")!;
    const ben = prefs[0].perMember.find((m) => m.memberId === "b")!;
    expect(ana.count).toBe(2);
    expect(ana.avg).toBe(9);
    expect(ben.count).toBe(1);
    expect(ben.avg).toBeNull();
  });

  it("keeps categories in their declared order", () => {
    const prefs = buildCategoryPreferences(
      [
        row("d1", "a", 7, "fun", "Fun", 2),
        row("d1", "b", 7, "fun", "Fun", 2),
        row("d2", "a", 7, "fun", "Fun", 2),
        row("d2", "b", 7, "fun", "Fun", 2),
        row("d1", "a", 5, "food", "Food", 0),
        row("d1", "b", 5, "food", "Food", 0),
        row("d2", "a", 5, "food", "Food", 0),
        row("d2", "b", 5, "food", "Food", 0),
      ],
      [A, B],
    );
    expect(prefs.map((p) => p.key)).toEqual(["food", "fun"]);
  });
});

describe("findPreferenceGaps — rating differences (neutral, gated)", () => {
  const prefsFrom = (rows: CategoryScoreRow[]) => buildCategoryPreferences(rows, [A, B]);

  it("no gap until each side has GAP_MIN_SAMPLE (3) dates for the category", () => {
    // 2 dates each, big difference — still suppressed
    const prefs = prefsFrom([
      row("d1", "a", 10),
      row("d2", "a", 10),
      row("d1", "b", 4),
      row("d2", "b", 4),
    ]);
    expect(findPreferenceGaps(prefs, [A, B], "a")).toEqual([]);
  });

  it("surfaces a gap once both sides have 3+ dates and the averages differ by >= 1", () => {
    const prefs = prefsFrom([
      row("d1", "a", 9),
      row("d2", "a", 9),
      row("d3", "a", 9),
      row("d1", "b", 6),
      row("d2", "b", 6),
      row("d3", "b", 6),
    ]);
    const gaps = findPreferenceGaps(prefs, [A, B], "a");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].delta).toBe(3);
    expect(gaps[0].higherMemberId).toBe("a");
  });

  it("subject is 'You' when the viewer scored higher, otherwise the other person's name", () => {
    const prefs = prefsFrom([
      row("d1", "a", 9),
      row("d2", "a", 9),
      row("d3", "a", 9),
      row("d1", "b", 6),
      row("d2", "b", 6),
      row("d3", "b", 6),
    ]);
    expect(findPreferenceGaps(prefs, [A, B], "a")[0].phrase).toMatch(/^You /);
    expect(findPreferenceGaps(prefs, [A, B], "b")[0].phrase).toMatch(/^Ana /);
  });

  it("never uses problem/conflict language and is skipped for a solo couple", () => {
    const prefs = prefsFrom([
      row("d1", "a", 10),
      row("d2", "a", 10),
      row("d3", "a", 10),
      row("d1", "b", 5),
      row("d2", "b", 5),
      row("d3", "b", 5),
    ]);
    const phrase = findPreferenceGaps(prefs, [A, B], "a")[0].phrase.toLowerCase();
    expect(phrase).not.toMatch(/worse|bad|problem|argue|wrong|conflict|disagree/);
    expect(findPreferenceGaps(prefs, [A], "a")).toEqual([]);
  });
});

describe("buildCoupleInsights — couple statistics", () => {
  const base: InsightInput = {
    topCategoryByScore: null,
    mostRevisitedType: null,
    bestValueDate: null,
    mostCommonActivity: null,
    favoritePlace: null,
    averageSpendLabel: null,
    moneyHidden: false,
  };

  it("emits an insight only when its data is present", () => {
    expect(buildCoupleInsights(base)).toEqual([]);
    const out = buildCoupleInsights({ ...base, topCategoryByScore: { label: "Food", avg: 8.2 } });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("top-category");
    expect(out[0].detail).toContain("8.2/10");
  });

  it("hides every money-derived insight when moneyHidden is set", () => {
    const withMoney: InsightInput = {
      ...base,
      bestValueDate: { title: "Picnic", score: 9, spendLabel: "$20" },
      averageSpendLabel: "$45",
      moneyHidden: true,
    };
    const keys = buildCoupleInsights(withMoney).map((i) => i.key);
    expect(keys).not.toContain("best-value");
    expect(keys).not.toContain("avg-spend");
  });

  it("pluralises the revisit count correctly", () => {
    const one = buildCoupleInsights({ ...base, mostRevisitedType: { label: "Dinner", count: 1 } });
    expect(one[0].detail).toMatch(/1 time\b/);
    const many = buildCoupleInsights({ ...base, mostRevisitedType: { label: "Dinner", count: 3 } });
    expect(many[0].detail).toMatch(/3 times\b/);
  });
});
