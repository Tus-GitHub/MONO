import "server-only";

import {
  DateStatus,
  PlaceCategory,
  RecommendationSignal,
  RecommendationTargetType,
  RevisitChoice,
} from "@prisma/client";

import { coupleMatch, type CoupleMatch, type MemberCategoryStat } from "@/lib/explore/compatibility";
import { DATE_IDEA_BY_KEY, DATE_IDEAS, type DateIdea } from "@/lib/explore/date-ideas";
import { classifyVisited, type VisitedStatus } from "@/lib/explore/visited";
import { PLACE_CATEGORY_LABEL, PLACE_CATEGORY_SHORT } from "@/lib/date/place-category";
import { prisma } from "@/lib/db/prisma";
import { isRevealed } from "@/lib/date/review-reveal";
import { averageScore } from "@/lib/review/scale";
import { NotFoundError } from "@/lib/errors";
import type { IconName } from "@/components/ui/icon";

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface RecommendedPlace {
  kind: "place";
  placeId: string;
  name: string;
  category: PlaceCategory;
  categoryLabel: string;
  city: string | null;
  imageUrl: string | null;
  coupleScore10: number | null;
  visitCount: number;
  status: VisitedStatus;
  match: CoupleMatch;
  feedback: RecommendationSignal | null;
}

export interface RecommendedIdea {
  kind: "idea";
  key: string;
  title: string;
  blurb: string;
  category: PlaceCategory;
  categoryLabel: string;
  icon: IconName;
  match: CoupleMatch;
  feedback: RecommendationSignal | null;
}

export interface ExploreSection {
  key: string;
  title: string;
  subtitle: string | null;
  places: RecommendedPlace[];
  ideas: RecommendedIdea[];
}

export interface ExploreHome {
  hasHistory: boolean;
  completedCount: number;
  savedPlaceCount: number;
  savedIdeas: RecommendedIdea[];
  sections: ExploreSection[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const feedbackKey = (type: "PLACE" | "IDEA", key: string) => `${type}:${key}`;

/** placeId/ideaKey → the couple's shared feedback signal. */
export async function getRecommendationFeedbackMap(
  coupleId: string,
): Promise<Map<string, RecommendationSignal>> {
  const rows = await prisma.recommendationFeedback.findMany({
    where: { coupleId },
    select: { targetType: true, targetKey: true, signal: true },
  });
  return new Map(rows.map((r) => [feedbackKey(r.targetType, r.targetKey), r.signal]));
}

function matchScore(match: CoupleMatch): number {
  return match.percent ?? -1;
}

/**
 * Set (or clear, with `signal: null`) the couple's shared feedback on one recommendation.
 * Couple-scoped, last-writer-wins. This just re-weights the deterministic ranking — it is not
 * a learning model.
 */
export async function setRecommendationFeedback(input: {
  coupleId: string;
  userId: string;
  targetType: RecommendationTargetType;
  targetKey: string;
  signal: RecommendationSignal | null;
}): Promise<void> {
  const { coupleId, userId, targetType, targetKey, signal } = input;

  if (targetType === RecommendationTargetType.IDEA) {
    if (!DATE_IDEA_BY_KEY[targetKey]) throw new NotFoundError("Unknown idea.");
  } else {
    const place = await prisma.place.findFirst({
      where: { id: targetKey, coupleId, deletedAt: null },
      select: { id: true },
    });
    if (!place) throw new NotFoundError("That place isn't yours to rate.");
  }

  if (signal == null) {
    await prisma.recommendationFeedback.deleteMany({
      where: { coupleId, targetType, targetKey },
    });
    return;
  }

  await prisma.recommendationFeedback.upsert({
    where: { coupleId_targetType_targetKey: { coupleId, targetType, targetKey } },
    create: { coupleId, userId, targetType, targetKey, signal },
    update: { userId, signal },
  });
}

const byMatchThenName = <T extends { match: CoupleMatch; name?: string; title?: string }>(
  a: T,
  b: T,
): number =>
  matchScore(b.match) - matchScore(a.match) ||
  (a.name ?? a.title ?? "").localeCompare(b.name ?? b.title ?? "");

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function getExploreHome(
  coupleId: string,
  _viewerId: string,
): Promise<ExploreHome> {
  const [memberRows, completed, savedPlaces, feedbackMap] = await Promise.all([
    prisma.coupleMember.findMany({
      where: { coupleId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { id: true, name: true, nickname: true } } },
    }),
    prisma.date.findMany({
      where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        completedAt: true,
        actualPlace: { select: { id: true, category: true, city: true } },
        plannedPlace: { select: { id: true, category: true, city: true } },
        reviews: { select: { authorId: true, submittedAt: true, overallRating: true } },
        revisitDecision: { select: { choice: true } },
      },
    }),
    prisma.place.findMany({
      where: { coupleId, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        imageUrl: true,
        isFavorite: true,
      },
    }),
    getRecommendationFeedbackMap(coupleId),
  ]);

  const members = memberRows.map((r) => ({
    id: r.user.id,
    name: r.user.nickname || r.user.name,
  }));
  const hasPartner = members.length >= 2;

  // --- Per-member × place-category rating history (reveal-gated) --------------
  const memberCat = new Map<string, Map<PlaceCategory, number[]>>();
  const allCat = new Map<PlaceCategory, number[]>();
  const placeAgg = new Map<
    string,
    { scores: number[]; visits: number; lastRevisit: RevisitChoice | null }
  >();
  const cityTally = new Map<string, number>();
  const doneCategories = new Set<PlaceCategory>();

  for (const date of completed) {
    const place = date.actualPlace ?? date.plannedPlace;
    const submitted = date.reviews.filter((r) => r.submittedAt != null);
    const revealed = isRevealed(submitted.length, hasPartner);

    if (place) {
      const agg = placeAgg.get(place.id) ?? { scores: [], visits: 0, lastRevisit: null };
      agg.visits += 1;
      if (date.revisitDecision) agg.lastRevisit = date.revisitDecision.choice;
      doneCategories.add(place.category);
      if (place.city) {
        const c = place.city.trim();
        if (c) cityTally.set(c, (cityTally.get(c) ?? 0) + 1);
      }
      if (revealed) {
        for (const review of submitted) {
          if (review.overallRating == null) continue;
          agg.scores.push(review.overallRating);
          allCat.set(place.category, [...(allCat.get(place.category) ?? []), review.overallRating]);
          const perMember = memberCat.get(review.authorId) ?? new Map<PlaceCategory, number[]>();
          perMember.set(place.category, [
            ...(perMember.get(place.category) ?? []),
            review.overallRating,
          ]);
          memberCat.set(review.authorId, perMember);
        }
      }
      placeAgg.set(place.id, agg);
    }
  }

  const mean = averageScore;

  const memberStatsFor = (category: PlaceCategory): MemberCategoryStat[] =>
    members.map((m) => {
      const xs = memberCat.get(m.id)?.get(category) ?? [];
      return {
        memberId: m.id,
        memberName: m.name,
        avg: mean(xs) ?? 0,
        count: xs.length,
      };
    });

  const coupleAvgFor = (category: PlaceCategory): number | null =>
    mean(allCat.get(category) ?? []);

  const score10 = (placeId: string): number | null => mean(placeAgg.get(placeId)?.scores ?? []);

  const matchFor = (category: PlaceCategory, revisitYes: boolean): CoupleMatch =>
    coupleMatch({
      categoryLabel: PLACE_CATEGORY_SHORT[category],
      memberStats: memberStatsFor(category),
      coupleAvgForCategory: coupleAvgFor(category),
      revisitYes,
    });

  // --- Builders ------------------------------------------------------------
  const buildPlace = (place: (typeof savedPlaces)[number]): RecommendedPlace => {
    const agg = placeAgg.get(place.id);
    const fb = feedbackMap.get(feedbackKey("PLACE", place.id)) ?? null;
    const cs = score10(place.id);
    const status = classifyVisited({
      visitCount: agg?.visits ?? 0,
      coupleScore10: cs,
      lastRevisit: agg?.lastRevisit ?? null,
      notForUs: fb === RecommendationSignal.NOT_FOR_US,
    });
    return {
      kind: "place",
      placeId: place.id,
      name: place.name,
      category: place.category,
      categoryLabel: PLACE_CATEGORY_LABEL[place.category],
      city: place.city,
      imageUrl: place.imageUrl,
      coupleScore10: cs,
      visitCount: agg?.visits ?? 0,
      status,
      match: matchFor(place.category, agg?.lastRevisit === RevisitChoice.YES),
      feedback: fb,
    };
  };

  const buildIdea = (idea: DateIdea): RecommendedIdea => ({
    kind: "idea",
    key: idea.key,
    title: idea.title,
    blurb: idea.blurb,
    category: idea.category,
    categoryLabel: PLACE_CATEGORY_LABEL[idea.category],
    icon: idea.icon,
    match: matchFor(idea.category, false),
    feedback: feedbackMap.get(feedbackKey("IDEA", idea.key)) ?? null,
  });

  const places = savedPlaces.map(buildPlace);
  const ideas = DATE_IDEAS.map(buildIdea);

  const notAvoid = (p: RecommendedPlace) => p.status !== "avoid";
  const ideaOk = (i: RecommendedIdea) => i.feedback !== RecommendationSignal.NOT_FOR_US;
  const completedCount = completed.length;
  const hasHistory = completedCount >= 3;

  // top-rated place categories (couple avg), best first
  const rankedCategories = [...allCat.entries()]
    .map(([category, xs]) => ({ category, avg: mean(xs) ?? 0, count: xs.length }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.category.localeCompare(b.category));

  const used = new Set<string>();
  const take = (list: RecommendedPlace[], n: number) => {
    const out: RecommendedPlace[] = [];
    for (const p of list) {
      if (out.length >= n) break;
      if (used.has(p.placeId)) continue;
      out.push(p);
      used.add(p.placeId);
    }
    return out;
  };

  // --- Sections ----------------------------------------------------------
  const sectionMap: Record<string, ExploreSection> = {};

  // A · Recommended for you
  {
    const revisitPlaces = places
      .filter((p) => notAvoid(p) && p.match.band === "high" && placeAgg.get(p.placeId)?.lastRevisit === RevisitChoice.YES)
      .sort(byMatchThenName);
    const freshTopCategory = places
      .filter((p) => notAvoid(p) && p.status === "new" && rankedCategories.slice(0, 3).some((c) => c.category === p.category))
      .sort(byMatchThenName);
    const strongIdeas = ideas
      .filter(ideaOk)
      .filter((i) => i.match.percent != null && i.match.percent >= 70)
      .sort(byMatchThenName)
      .slice(0, 3);

    const placesPart = take([...revisitPlaces, ...freshTopCategory], 5);
    if (placesPart.length + strongIdeas.length > 0 && (hasHistory || revisitPlaces.length > 0)) {
      sectionMap.recommended = {
        key: "recommended",
        title: "Recommended for you",
        subtitle: "Blended from your ratings, revisit calls and the dates you both enjoy.",
        places: placesPart,
        ideas: strongIdeas,
      };
    }
  }

  // B · Because you loved …
  {
    const loved = places
      .filter((p) => p.status === "loved")
      .sort((a, b) => (b.coupleScore10 ?? 0) - (a.coupleScore10 ?? 0) || b.visitCount - a.visitCount)[0];
    if (loved) {
      const sameCat = places
        .filter((p) => notAvoid(p) && p.status === "new" && p.category === loved.category)
        .sort(byMatchThenName);
      const catIdeas = ideas.filter(ideaOk).filter((i) => i.category === loved.category).slice(0, 2);
      const picked = take(sameCat, 5);
      if (picked.length + catIdeas.length > 0) {
        sectionMap.loved = {
          key: "loved",
          title: `Because you loved ${loved.name}`,
          subtitle: `More ${loved.categoryLabel.toLowerCase()} ideas in the same spirit.`,
          places: picked,
          ideas: catIdeas,
        };
      }
    }
  }

  // C · Try something different — categories never done
  if (completedCount >= 1) {
    const untried = (Object.values(PlaceCategory) as PlaceCategory[]).filter(
      (c) => c !== PlaceCategory.OTHER && !doneCategories.has(c),
    );
    const diffPlaces: RecommendedPlace[] = [];
    const diffIdeas: RecommendedIdea[] = [];
    for (const category of untried.slice(0, 4)) {
      const p = places.find((x) => notAvoid(x) && x.status === "new" && x.category === category && !used.has(x.placeId));
      if (p) {
        diffPlaces.push(p);
        used.add(p.placeId);
        continue;
      }
      const i = ideas.find((x) => ideaOk(x) && x.category === category && !diffIdeas.includes(x));
      if (i) diffIdeas.push(i);
    }
    if (diffPlaces.length + diffIdeas.length > 0) {
      sectionMap.different = {
        key: "different",
        title: "Try something different",
        subtitle: "Kinds of date the two of you haven't done yet.",
        places: diffPlaces,
        ideas: diffIdeas,
      };
    }
  }

  // D · Nearby — the couple's most-visited city
  {
    const topCity = [...cityTally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    if (topCity) {
      const nearby = places
        .filter((p) => notAvoid(p) && p.city?.trim() === topCity && p.status !== "loved")
        .sort(byMatchThenName);
      const picked = take(nearby, 6);
      if (picked.length > 0) {
        sectionMap.nearby = {
          key: "nearby",
          title: "Nearby",
          subtitle: `Saved places in and around ${topCity}.`,
          places: picked,
          ideas: [],
        };
      }
    }
  }

  // E · Date ideas — the whole catalogue (ruled-out ones sink to the bottom, still toggle-able)
  {
    const rank = (i: RecommendedIdea) => (i.feedback === RecommendationSignal.NOT_FOR_US ? 1 : 0);
    const ordered = [...ideas].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        matchScore(b.match) - matchScore(a.match) ||
        a.title.localeCompare(b.title),
    );
    sectionMap.ideas = {
      key: "ideas",
      title: "Date ideas",
      subtitle: "Plan-anywhere ideas — pick one and it becomes a draft date.",
      places: [],
      ideas: ordered,
    };
  }

  // F · Previously enjoyed
  {
    const enjoyed = places
      .filter((p) => p.status === "loved" || p.status === "revisit")
      .sort((a, b) => (b.coupleScore10 ?? 0) - (a.coupleScore10 ?? 0) || b.visitCount - a.visitCount)
      .slice(0, 6);
    if (enjoyed.length > 0) {
      sectionMap.enjoyed = {
        key: "enjoyed",
        title: "Previously enjoyed",
        subtitle: "Places worth another visit.",
        places: enjoyed,
        ideas: [],
      };
    }
  }

  // H · Your saved places — ones you've not formed a strong view on (loved/revisit live above)
  {
    const rest = places
      .filter(
        (p) =>
          (p.status === "new" || p.status === "visited") && !used.has(p.placeId),
      )
      .sort(
        (a, b) =>
          Number(b.status === "loved") - Number(a.status === "loved") ||
          matchScore(b.match) - matchScore(a.match) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 8);
    if (rest.length > 0) {
      sectionMap.saved = {
        key: "saved",
        title: "Your saved places",
        subtitle: "Everything you've kept while planning.",
        places: rest,
        ideas: [],
      };
    }
  }

  // G · Hidden gems — quietly high-rated, not yet a favourite
  {
    const gems = savedPlaces
      .filter((p) => !p.isFavorite)
      .map(buildPlace)
      .filter((p) => p.status !== "avoid" && (p.coupleScore10 ?? 0) >= 7)
      .sort((a, b) => (b.coupleScore10 ?? 0) - (a.coupleScore10 ?? 0))
      .slice(0, 6);
    if (gems.length > 0) {
      sectionMap.hidden = {
        key: "hidden",
        title: "Hidden gems",
        subtitle: "Quietly high-rated between you, and not a favourite yet.",
        places: gems,
        ideas: [],
      };
    }
  }

  const order = hasHistory
    ? ["recommended", "loved", "enjoyed", "nearby", "different", "ideas", "hidden", "saved"]
    : ["ideas", "different", "nearby", "saved", "recommended", "loved", "enjoyed", "hidden"];

  const sections = order
    .map((key) => sectionMap[key])
    .filter((s): s is ExploreSection => s != null && s.places.length + s.ideas.length > 0);

  const savedIdeas = ideas.filter((i) => i.feedback === RecommendationSignal.SAVED);

  return {
    hasHistory,
    completedCount,
    savedPlaceCount: savedPlaces.length,
    savedIdeas,
    sections,
  };
}
