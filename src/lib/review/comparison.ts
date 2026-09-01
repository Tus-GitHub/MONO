import { ReviewRevisit } from "@prisma/client";

/**
 * The combined-review model — pure and deterministic. Only ever built once *both* people have
 * submitted (see `lib/date/review-reveal`); it never sees a draft. The one couple score is a
 * plain mean of the two overalls, rounded to one decimal — no hidden weighting anywhere.
 */

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface CategoryComparison {
  id: string;
  label: string;
  you: number | null;
  partner: number | null;
  /** (you + partner) / 2 when both rated; otherwise whichever exists; else null. */
  combined: number | null;
  /** you − partner when both rated. */
  delta: number | null;
}

export type InsightKind = "top" | "agreement" | "lean" | "low";

export interface AgreementInsight {
  kind: InsightKind;
  text: string;
}

export interface ReviewComparison {
  categories: CategoryComparison[];
  youOverall: number | null;
  partnerOverall: number | null;
  /** `(youOverall + partnerOverall) / 2`, one decimal. The single couple score. */
  coupleScore: number | null;
  /** Mean of the per-category combined values — informational, *not* the couple score. */
  categoryAverage: number | null;
  topShared: CategoryComparison | null;
  lowShared: CategoryComparison | null;
  insights: AgreementInsight[];
}

export function buildReviewComparison(input: {
  categories: { id: string; label: string }[];
  youScores: Record<string, number>;
  partnerScores: Record<string, number>;
  youOverall: number | null;
  partnerOverall: number | null;
  partnerName: string;
}): ReviewComparison {
  const { categories, youScores, partnerScores, youOverall, partnerOverall, partnerName } = input;

  const cats: CategoryComparison[] = categories.map((category) => {
    const you = youScores[category.id] ?? null;
    const partner = partnerScores[category.id] ?? null;
    const combined =
      you != null && partner != null ? round1((you + partner) / 2) : (you ?? partner ?? null);
    const delta = you != null && partner != null ? you - partner : null;
    return { id: category.id, label: category.label, you, partner, combined, delta };
  });

  const bothRated = cats.filter((c) => c.you != null && c.partner != null);
  const withCombined = cats.filter((c) => c.combined != null);

  const coupleScore =
    youOverall != null && partnerOverall != null
      ? round1((youOverall + partnerOverall) / 2)
      : (youOverall ?? partnerOverall ?? null);

  const categoryAverage = withCombined.length
    ? round1(
        withCombined.reduce((sum, c) => sum + (c.combined as number), 0) / withCombined.length,
      )
    : null;

  const byCombinedDesc = [...bothRated].sort(
    (a, b) => (b.combined as number) - (a.combined as number) || a.label.localeCompare(b.label),
  );
  const topShared = byCombinedDesc[0] ?? null;
  const lowShared = bothRated.length > 1 ? byCombinedDesc[byCombinedDesc.length - 1] : null;

  return {
    categories: cats,
    youOverall,
    partnerOverall,
    coupleScore,
    categoryAverage,
    topShared,
    lowShared,
    insights: buildInsights({ bothRated, topShared, lowShared, partnerName }),
  };
}

function buildInsights({
  bothRated,
  topShared,
  lowShared,
  partnerName,
}: {
  bothRated: CategoryComparison[];
  topShared: CategoryComparison | null;
  lowShared: CategoryComparison | null;
  partnerName: string;
}): AgreementInsight[] {
  const out: AgreementInsight[] = [];
  const lower = (label: string) => label.toLowerCase();

  if (topShared && topShared.combined != null && topShared.combined >= 7) {
    out.push({ kind: "top", text: `${topShared.label} was your strongest shared category.` });
  }

  for (const c of bothRated) {
    if (out.length >= 5) break;
    if (Math.abs(c.delta as number) <= 1 && (c.combined as number) >= 8) {
      out.push({ kind: "agreement", text: `You both loved the ${lower(c.label)}.` });
    }
  }

  const leans = bothRated
    .filter((c) => Math.abs(c.delta as number) >= 3)
    .sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number));
  for (const c of leans) {
    if (out.length >= 5) break;
    out.push({
      kind: "lean",
      text:
        (c.delta as number) > 0
          ? `You enjoyed the ${lower(c.label)} more than ${partnerName} did.`
          : `${partnerName} enjoyed the ${lower(c.label)} more than you did.`,
    });
  }

  if (
    lowShared &&
    lowShared.combined != null &&
    lowShared.combined < 6 &&
    lowShared.id !== topShared?.id &&
    out.length < 5
  ) {
    out.push({ kind: "low", text: `${lowShared.label} was the quietest one for the two of you.` });
  }

  if (out.length === 0 && bothRated.length > 0) {
    out.push({ kind: "agreement", text: "Your scores landed close across the board." });
  }

  return out.slice(0, 5);
}

// --- Revisit compatibility -------------------------------------------------

const REVISIT_RANK: Record<ReviewRevisit, number> = {
  DEFINITELY: 3,
  MAYBE: 2,
  PROBABLY_NOT: 1,
  NEVER_AGAIN: 0,
};

export type RevisitLevel =
  | "strong"
  | "worth-considering"
  | "mixed"
  | "different"
  | "one-off";

export interface RevisitCompatibility {
  level: RevisitLevel;
  label: string;
  blurb: string;
  tone: "high" | "mid" | "low";
}

/** Compare the two independent "would you go again?" calls. Never framed as an argument. */
export function revisitCompatibility(
  you: ReviewRevisit | null | undefined,
  partner: ReviewRevisit | null | undefined,
): RevisitCompatibility | null {
  if (!you || !partner) return null;
  const lo = Math.min(REVISIT_RANK[you], REVISIT_RANK[partner]);
  const hi = Math.max(REVISIT_RANK[you], REVISIT_RANK[partner]);

  if (lo === 3) {
    return { level: "strong", label: "Strong revisit", blurb: "You're both already in.", tone: "high" };
  }
  if (lo >= 2) {
    return {
      level: "worth-considering",
      label: "Worth considering",
      blurb: "Neither of you would turn it down.",
      tone: "high",
    };
  }
  if (hi === 3) {
    return {
      level: "different",
      label: "Different opinions",
      blurb: "One of you is keen, one less so — one to talk through.",
      tone: "mid",
    };
  }
  if (hi <= 1) {
    return { level: "one-off", label: "A one-off", blurb: "Good to have done once.", tone: "low" };
  }
  return {
    level: "mixed",
    label: "Mixed feelings",
    blurb: "Somewhere between yes and no.",
    tone: "mid",
  };
}
