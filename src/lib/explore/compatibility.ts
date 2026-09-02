/**
 * Couple Match % — a private, deterministic compatibility read for one recommendation. It is a
 * plain weighted average of how each partner has historically rated this *kind* of date, plus
 * how closely their scores agree. No model, no training, no randomness: the same history always
 * yields the same number, and when there isn't enough history the percent is `null` rather than
 * a made-up figure.
 */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n);

export interface MemberCategoryStat {
  memberId: string;
  memberName: string;
  /** This member's mean overall rating (1–10) for revealed dates in the target category. */
  avg: number;
  /** How many revealed, rated dates that average is built from. */
  count: number;
}

export type MatchBand = "high" | "medium" | "low" | "unknown";

export interface CoupleMatch {
  percent: number | null;
  reason: string;
  band: MatchBand;
}

function bandOf(percent: number): MatchBand {
  if (percent >= 80) return "high";
  if (percent >= 60) return "medium";
  return "low";
}

export function coupleMatch(input: {
  categoryLabel: string;
  memberStats: MemberCategoryStat[];
  coupleAvgForCategory: number | null;
  revisitYes?: boolean;
}): CoupleMatch {
  const cat = input.categoryLabel.toLowerCase();
  const withData = input.memberStats.filter((s) => s.count > 0);

  if (input.revisitYes) {
    return {
      percent: 94,
      reason: "You both said you'd come back here.",
      band: "high",
    };
  }

  if (withData.length >= 2) {
    const [a, b] = withData;
    const level = ((a.avg + b.avg) / 2 - 1) / 9; // 0..1
    const agree = 1 - Math.min(Math.abs(a.avg - b.avg), 5) / 5; // 0..1
    const percent = clamp(round(100 * (0.55 * level + 0.3 * agree + 0.15)), 42, 98);

    let reason: string;
    if (a.avg >= 7 && b.avg >= 7 && agree >= 0.8) {
      reason = `Both of you rate ${cat} dates highly.`;
    } else if (agree >= 0.8) {
      reason = `You're usually on the same page about ${cat} dates.`;
    } else if (Math.min(a.avg, b.avg) >= 6) {
      reason = `${cat[0].toUpperCase()}${cat.slice(1)} dates land well with both of you.`;
    } else if (Math.abs(a.avg - b.avg) >= 2.5) {
      const keen = a.avg >= b.avg ? a : b;
      reason = `${keen.memberName} enjoys ${cat} dates more — worth trying together.`;
    } else {
      reason = `A change of pace from your usual.`;
    }
    return { percent, reason, band: bandOf(percent) };
  }

  if (withData.length === 1) {
    const s = withData[0];
    const level = (s.avg - 1) / 9;
    const percent = clamp(round(100 * (0.5 * level + 0.3)), 40, 88);
    return {
      percent,
      reason:
        s.avg >= 7
          ? `${s.memberName} rates ${cat} dates ${s.avg.toFixed(1)}/10 — no read on the other yet.`
          : `Only one of you has a ${cat} date on record so far.`,
      band: bandOf(percent),
    };
  }

  if (input.coupleAvgForCategory != null) {
    const level = (input.coupleAvgForCategory - 1) / 9;
    const percent = clamp(round(100 * (0.55 * level + 0.28)), 40, 92);
    return {
      percent,
      reason: `Your ${cat} dates average ${input.coupleAvgForCategory.toFixed(1)}/10.`,
      band: bandOf(percent),
    };
  }

  return {
    percent: null,
    reason: `You haven't done a ${cat} date yet.`,
    band: "unknown",
  };
}
