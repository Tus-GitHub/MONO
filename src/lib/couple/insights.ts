/**
 * Private relationship insights — pure & deterministic. Every number here is a plain average
 * or count over the couple's own real data; nothing is inferred, predicted, or personality-
 * profiled. Guard thresholds keep thin data from turning into a confident-sounding claim.
 */

import type { IconName } from "@/components/ui/icon";
import { averageScore, round1 } from "@/lib/review/scale";

// Re-export the house rounding so existing importers of `@/lib/couple/insights` keep working.
export { round1 };

// A rounded mean — the same thing the review scale calls `averageScore`.
const mean = averageScore;

// ---------------------------------------------------------------------------
// Category preferences (part 3)
// ---------------------------------------------------------------------------

/** A shown per-category average needs at least this many distinct rated dates behind it. */
export const CATEGORY_MIN_SAMPLE = 2;
/** A per-person gap is only surfaced once each side has this many dates for the category… */
export const GAP_MIN_SAMPLE = 3;
/** …and the two averages differ by at least this many points. */
export const GAP_MIN_DELTA = 1;

export interface MemberRef {
  id: string;
  name: string;
}

/** One person's score for one category on one revealed date. */
export interface CategoryScoreRow {
  dateId: string;
  categoryKey: string;
  categoryLabel: string;
  categoryOrder: number;
  memberId: string;
  score: number; // 1..10
}

export interface CategoryPreference {
  key: string;
  label: string;
  /** Mean of every member's scores for this category — both people weighted equally. */
  coupleAvg: number | null;
  /** Distinct revealed dates that contributed a score in this category. */
  sampleSize: number;
  perMember: { memberId: string; avg: number | null; count: number }[];
}

export function buildCategoryPreferences(
  rows: CategoryScoreRow[],
  members: MemberRef[],
): CategoryPreference[] {
  const byCategory = new Map<string, CategoryScoreRow[]>();
  for (const row of rows) {
    const bucket = byCategory.get(row.categoryKey);
    if (bucket) bucket.push(row);
    else byCategory.set(row.categoryKey, [row]);
  }

  const order = new Map<string, number>();
  const prefs: CategoryPreference[] = [];
  for (const bucket of byCategory.values()) {
    const sampleSize = new Set(bucket.map((r) => r.dateId)).size;
    const first = bucket[0];
    order.set(first.categoryKey, first.categoryOrder);

    const perMember = members.map((member) => {
      const mine = bucket.filter((r) => r.memberId === member.id);
      const count = new Set(mine.map((r) => r.dateId)).size;
      return {
        memberId: member.id,
        count,
        avg: count >= CATEGORY_MIN_SAMPLE ? mean(mine.map((r) => r.score)) : null,
      };
    });

    prefs.push({
      key: first.categoryKey,
      label: first.categoryLabel,
      sampleSize,
      coupleAvg: sampleSize >= CATEGORY_MIN_SAMPLE ? mean(bucket.map((r) => r.score)) : null,
      perMember,
    });
  }

  return prefs.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}

// ---------------------------------------------------------------------------
// Preference differences (part 4) — neutral language, never a "problem"
// ---------------------------------------------------------------------------

export interface PreferenceGap {
  categoryKey: string;
  categoryLabel: string;
  higherMemberId: string;
  /** Absolute difference of the two averages, one decimal. */
  delta: number;
  /** A calm, factual sentence. Subject is "You" when the viewer scored higher, else the name. */
  phrase: string;
}

function gapPhrase(who: string, isViewer: boolean, category: string, delta: number): string {
  const verb = (base: string) => (isViewer ? base : `${base}s`);
  const cat = category.toLowerCase();
  if (delta < 1.7) return `${who} ${verb("rate")} ${cat} a little higher.`;
  if (delta < 2.6) return `${who} ${verb("tend")} to enjoy ${cat} dates more.`;
  return `${who} consistently ${verb("rate")} ${cat} higher.`;
}

export function findPreferenceGaps(
  prefs: CategoryPreference[],
  members: MemberRef[],
  viewerId: string,
): PreferenceGap[] {
  if (members.length < 2) return [];
  const gaps: PreferenceGap[] = [];

  for (const pref of prefs) {
    const scored = pref.perMember.filter(
      (m) => m.avg != null && m.count >= GAP_MIN_SAMPLE,
    );
    if (scored.length < 2) continue;

    const sorted = [...scored].sort((a, b) => (b.avg as number) - (a.avg as number));
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const delta = round1((top.avg as number) - (bottom.avg as number));
    if (delta < GAP_MIN_DELTA) continue;

    const isViewer = top.memberId === viewerId;
    const who = isViewer
      ? "You"
      : (members.find((m) => m.id === top.memberId)?.name ?? "They");

    gaps.push({
      categoryKey: pref.key,
      categoryLabel: pref.label,
      higherMemberId: top.memberId,
      delta,
      phrase: gapPhrase(who, isViewer, pref.label, delta),
    });
  }

  return gaps.sort((a, b) => b.delta - a.delta);
}

// ---------------------------------------------------------------------------
// Couple insights (part 5) — one fact each, only when the data supports it
// ---------------------------------------------------------------------------

export interface CoupleInsight {
  key: string;
  icon: IconName;
  label: string;
  detail: string;
}

export interface InsightInput {
  topCategoryByScore: { label: string; avg: number } | null;
  mostRevisitedType: { label: string; count: number } | null;
  bestValueDate: { title: string; score: number; spendLabel: string } | null;
  mostCommonActivity: { title: string; count: number } | null;
  favoritePlace: { name: string; visits: number } | null;
  averageSpendLabel: string | null;
  moneyHidden: boolean;
}

export function buildCoupleInsights(input: InsightInput): CoupleInsight[] {
  const out: CoupleInsight[] = [];

  if (input.topCategoryByScore) {
    out.push({
      key: "top-category",
      icon: "star",
      label: "Most successful kind of date",
      detail: `Your ${input.topCategoryByScore.label.toLowerCase()} dates rate highest, at ${input.topCategoryByScore.avg.toFixed(
        1,
      )}/10.`,
    });
  }

  if (input.mostRevisitedType) {
    out.push({
      key: "most-revisited",
      icon: "refresh",
      label: "Most revisited type",
      detail: `You've said "again" to ${input.mostRevisitedType.label.toLowerCase()} dates ${
        input.mostRevisitedType.count
      } time${input.mostRevisitedType.count === 1 ? "" : "s"}.`,
    });
  }

  if (input.bestValueDate && !input.moneyHidden) {
    out.push({
      key: "best-value",
      icon: "wallet",
      label: "Best value date",
      detail: `"${input.bestValueDate.title}" — ${input.bestValueDate.score.toFixed(1)}/10 for ${
        input.bestValueDate.spendLabel
      }.`,
    });
  }

  if (input.mostCommonActivity) {
    out.push({
      key: "common-activity",
      icon: "sparkles",
      label: "Most common activity",
      detail: `"${input.mostCommonActivity.title}" has been part of ${
        input.mostCommonActivity.count
      } dates.`,
    });
  }

  if (input.favoritePlace) {
    out.push({
      key: "favorite-place",
      icon: "mapPin",
      label: "Favourite place",
      detail: `${input.favoritePlace.name} — ${input.favoritePlace.visits} dates there.`,
    });
  }

  if (input.averageSpendLabel && !input.moneyHidden) {
    out.push({
      key: "avg-spend",
      icon: "wallet",
      label: "Average date spend",
      detail: `About ${input.averageSpendLabel} a date, across the ones you've tracked.`,
    });
  }

  return out;
}
