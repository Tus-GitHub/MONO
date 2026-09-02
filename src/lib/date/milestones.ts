import type { IconName } from "@/components/ui/icon";

/**
 * Real milestones only — every one maps to a concrete fact in the couple's own date records
 * (the count, a first city, a repeat place, an anniversary match, the top score). Nothing here
 * is invented for effect.
 */

export type MilestoneKind =
  | "first-date"
  | "nth-date"
  | "first-city"
  | "regulars"
  | "anniversary"
  | "top-score";

export interface Milestone {
  kind: MilestoneKind;
  label: string;
  icon: IconName;
}

export interface MilestoneInput {
  id: string;
  dateYmd: string | null; // YYYY-MM-DD
  placeId: string | null;
  placeName: string | null;
  placeCity: string | null;
  coupleScore: number | null;
}

const NTH: number[] = [5, 10, 25, 50, 75, 100, 150, 200, 250];

export function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function ordinalLabel(n: number): string {
  return `${n}${ordinalSuffix(n)}`;
}

export interface MilestoneResult {
  /** dateId → up to two milestones, most notable first. */
  byId: Map<string, Milestone[]>;
  /** dateId → chronological position among all completed dates (1 = first). */
  ordinals: Map<string, number>;
  /** every distinct city the couple has had a date in, in the order first visited. */
  citiesExplored: string[];
}

export function computeMilestones(
  itemsNewestFirst: MilestoneInput[],
  opts: { anniversaryMMDD?: string | null } = {},
): MilestoneResult {
  const oldestFirst = [...itemsNewestFirst].reverse();

  const byId = new Map<string, Milestone[]>();
  const ordinals = new Map<string, number>();
  const seenCities: string[] = [];
  const placeVisits = new Map<string, number>();

  const scored = oldestFirst.filter((i) => i.coupleScore != null);
  const topId =
    scored.length >= 3
      ? scored.reduce((best, i) => (i.coupleScore! > best.coupleScore! ? i : best)).id
      : null;
  const topScore = topId ? scored.find((i) => i.id === topId)?.coupleScore ?? null : null;

  oldestFirst.forEach((item, index) => {
    const ordinal = index + 1;
    ordinals.set(item.id, ordinal);
    const out: Milestone[] = [];

    if (
      opts.anniversaryMMDD &&
      item.dateYmd &&
      item.dateYmd.slice(5) === opts.anniversaryMMDD
    ) {
      out.push({ kind: "anniversary", label: "On your anniversary", icon: "heart" });
    }

    if (ordinal === 1) {
      out.push({ kind: "first-date", label: "Your very first date", icon: "sparkles" });
    } else if (NTH.includes(ordinal)) {
      out.push({
        kind: "nth-date",
        label: `Your ${ordinalLabel(ordinal)} date together`,
        icon: "sparkles",
      });
    }

    if (item.id === topId && topScore != null) {
      out.push({
        kind: "top-score",
        label: `Your highest-rated date — ${topScore.toFixed(1)}/10`,
        icon: "star",
      });
    }

    const city = item.placeCity?.trim();
    if (city && !seenCities.some((c) => c.toLowerCase() === city.toLowerCase())) {
      seenCities.push(city);
      out.push({
        kind: "first-city",
        label:
          seenCities.length === 1
            ? `First date in ${city}`
            : `${city} — city number ${seenCities.length}`,
        icon: "compass",
      });
    }

    if (item.placeId) {
      const visits = (placeVisits.get(item.placeId) ?? 0) + 1;
      placeVisits.set(item.placeId, visits);
      if (visits === 3 && item.placeName) {
        out.push({
          kind: "regulars",
          label: `Regulars at ${item.placeName}`,
          icon: "mapPin",
        });
      }
    }

    if (out.length > 0) byId.set(item.id, out.slice(0, 2));
  });

  return { byId, ordinals, citiesExplored: seenCities };
}
