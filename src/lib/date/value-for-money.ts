/**
 * Ties a date's recorded spend to the review's "Value for money" score — pure. Uses only the
 * date's own expense records and the score the couple actually gave; it infers nothing else
 * about anyone's finances.
 */

export type ValueTier = "great" | "fair" | "steep" | "unknown";

export interface ValueForMoney {
  spendCents: number | null;
  /** combined "Value for money" category score (1–10), when the review has revealed. */
  valueScore: number | null;
  tier: ValueTier;
  line: string;
}

export function valueForMoney(input: {
  spendCents: number | null;
  valueScore: number | null;
}): ValueForMoney {
  const { spendCents, valueScore } = input;

  if (valueScore == null || spendCents == null) {
    return { spendCents, valueScore, tier: "unknown", line: "" };
  }

  if (valueScore >= 8) {
    return {
      spendCents,
      valueScore,
      tier: "great",
      line: "Great value — you both felt it was well worth the money.",
    };
  }
  if (valueScore >= 6) {
    return {
      spendCents,
      valueScore,
      tier: "fair",
      line: "Fair value for what it cost.",
    };
  }
  return {
    spendCents,
    valueScore,
    tier: "steep",
    line: "It felt a little steep for how it landed.",
  };
}
