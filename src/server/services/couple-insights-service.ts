import "server-only";

import { DateStatus, PlaceCategory, RevisitChoice } from "@prisma/client";

import {
  buildCategoryPreferences,
  buildCoupleInsights,
  findPreferenceGaps,
  type CategoryPreference,
  type CategoryScoreRow,
  type CoupleInsight,
  type MemberRef,
  type PreferenceGap,
} from "@/lib/couple/insights";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { dateCoupleScore, isRevealed } from "@/lib/date/review-reveal";
import { averageScore } from "@/lib/review/scale";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils/format";
import { getUserSettings } from "@/server/services/user-settings-service";

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface CoupleProfileMember {
  id: string;
  name: string;
  nickname: string | null;
  pronouns: string | null;
  avatarUrl: string | null;
  role: string;
  isViewer: boolean;
}

export interface RatedDateRef {
  id: string;
  title: string;
  dateYmd: string | null;
  score: number;
}

export interface DateStatistics {
  totalDates: number;
  completedDates: number;
  memoriesKept: number;
  placesVisited: number;
  citiesVisited: number;
  averageCoupleScore: number | null;
  /** How many completed dates have a revealed couple score — context for the average. */
  scoredDateCount: number;
  highestRatedDate: RatedDateRef | null;
  /** Only set when there are ≥2 scored dates and they actually differ. */
  lowestRatedDate: RatedDateRef | null;
  favoriteCategory: { category: PlaceCategory; label: string; count: number } | null;
  /** null when nothing has been recorded (distinct from a real 0). */
  totalSpendCents: number | null;
  currency: string;
}

export interface CoupleProfile {
  couple: {
    id: string;
    name: string | null;
    description: string | null;
    photoUrl: string | null;
    anniversaryAt: string | null;
    currency: string;
    createdAtIso: string;
  };
  members: CoupleProfileMember[];
  statistics: DateStatistics;
  categoryPreferences: CategoryPreference[];
  /** false when the viewer has hidden the per-person breakdown in privacy settings. */
  preferenceBreakdownVisible: boolean;
  preferenceGaps: PreferenceGap[];
  insights: CoupleInsight[];
  /** Mirrors the viewer's privacy toggles so the UI can explain a blanked figure. */
  moneyInsightsHidden: boolean;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const norm = (value: string) => value.trim().replace(/\s+/g, " ");

export async function getCoupleProfile(
  coupleId: string,
  viewerId: string,
): Promise<CoupleProfile> {
  const [
    couple,
    memberRows,
    totalDates,
    memoriesKept,
    completed,
    categories,
    spendAgg,
    settings,
  ] = await Promise.all([
      prisma.couple.findUniqueOrThrow({
        where: { id: coupleId },
        select: {
          id: true,
          name: true,
          description: true,
          photoUrl: true,
          anniversaryAt: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.coupleMember.findMany({
        where: { coupleId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          user: {
            select: { id: true, name: true, nickname: true, pronouns: true, avatarUrl: true },
          },
        },
      }),
      prisma.date.count({ where: { coupleId, deletedAt: null } }),
      prisma.memory.count({ where: { coupleId, deletedAt: null } }),
      prisma.date.findMany({
        where: { coupleId, deletedAt: null, status: DateStatus.COMPLETED },
        select: {
          id: true,
          title: true,
          scheduledFor: true,
          actualStartAt: true,
          actualSpendCents: true,
          actualPlace: { select: { id: true, name: true, category: true, city: true } },
          plannedPlace: { select: { id: true, name: true, category: true, city: true } },
          revisitDecision: { select: { choice: true } },
          reviews: {
            select: {
              authorId: true,
              submittedAt: true,
              overallRating: true,
              ratings: { select: { categoryId: true, score: true } },
            },
          },
          activities: { select: { title: true } },
          expenses: { where: { deletedAt: null }, select: { amountCents: true } },
        },
      }),
      prisma.reviewCategory.findMany({
        where: { coupleId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, key: true, label: true, sortOrder: true },
      }),
      prisma.expense.aggregate({
        where: { coupleId, deletedAt: null },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      getUserSettings(viewerId),
    ]);

  const members: CoupleProfileMember[] = memberRows.map((row) => ({
    id: row.user.id,
    name: row.user.name,
    nickname: row.user.nickname,
    pronouns: row.user.pronouns,
    avatarUrl: row.user.avatarUrl,
    role: row.role,
    isViewer: row.user.id === viewerId,
  }));
  const memberRefs: MemberRef[] = members.map((m) => ({ id: m.id, name: m.nickname || m.name }));
  const hasPartner = members.length >= 2;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // --- Per-date derived values -----------------------------------------------
  const placeIds = new Set<string>();
  const cities = new Set<string>();
  const categoryTally = new Map<PlaceCategory, number>();
  const ratedDates: RatedDateRef[] = [];
  const scoreRows: CategoryScoreRow[] = [];
  const revisitTypeTally = new Map<PlaceCategory, number>();
  const activityTally = new Map<string, { label: string; dates: Set<string> }>();
  const placeVisitTally = new Map<string, { name: string; count: number }>();
  const perDateSpend: { title: string; score: number | null; spendCents: number }[] = [];

  for (const date of completed) {
    const dateYmd = (date.actualStartAt ?? date.scheduledFor)?.toISOString().slice(0, 10) ?? null;
    const place = date.actualPlace ?? date.plannedPlace;
    if (place) {
      placeIds.add(place.id);
      if (place.city) cities.add(place.city.trim().toLowerCase());
      categoryTally.set(place.category, (categoryTally.get(place.category) ?? 0) + 1);
      const pv = placeVisitTally.get(place.id) ?? { name: place.name, count: 0 };
      pv.count += 1;
      placeVisitTally.set(place.id, pv);
      if (date.revisitDecision?.choice === RevisitChoice.YES) {
        revisitTypeTally.set(place.category, (revisitTypeTally.get(place.category) ?? 0) + 1);
      }
    }

    for (const activity of date.activities) {
      const key = norm(activity.title).toLowerCase();
      if (!key) continue;
      const entry = activityTally.get(key) ?? { label: norm(activity.title), dates: new Set() };
      entry.dates.add(date.id);
      activityTally.set(key, entry);
    }

    const submitted = date.reviews.filter((r) => r.submittedAt != null);
    const revealed = isRevealed(submitted.length, hasPartner);

    const overalls = submitted
      .map((r) => r.overallRating)
      .filter((n): n is number => n != null);
    const coupleScore = dateCoupleScore(overalls, revealed);
    if (coupleScore != null) {
      ratedDates.push({ id: date.id, title: date.title, dateYmd, score: coupleScore });
    }

    if (revealed) {
      for (const review of submitted) {
        for (const rating of review.ratings) {
          const category = categoryById.get(rating.categoryId);
          if (!category) continue;
          scoreRows.push({
            dateId: date.id,
            categoryKey: category.key,
            categoryLabel: category.label,
            categoryOrder: category.sortOrder,
            memberId: review.authorId,
            score: rating.score,
          });
        }
      }
    }

    const spendCents =
      date.actualSpendCents ??
      (date.expenses.length > 0
        ? date.expenses.reduce((sum, e) => sum + e.amountCents, 0)
        : 0);
    perDateSpend.push({ title: date.title, score: coupleScore, spendCents });
  }

  // --- Statistics (part 2) -------------------------------------------------
  ratedDates.sort((a, b) => b.score - a.score || (a.dateYmd ?? "").localeCompare(b.dateYmd ?? ""));
  const highestRatedDate = ratedDates[0] ?? null;
  const lowestCandidate = ratedDates[ratedDates.length - 1] ?? null;
  const lowestRatedDate =
    ratedDates.length >= 2 && highestRatedDate && lowestCandidate &&
    highestRatedDate.score !== lowestCandidate.score
      ? lowestCandidate
      : null;

  const averageCoupleScore = averageScore(ratedDates.map((d) => d.score));

  const favoriteCategoryEntry = [...categoryTally.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];

  const currency = couple.currency;
  const statistics: DateStatistics = {
    totalDates,
    completedDates: completed.length,
    memoriesKept,
    placesVisited: placeIds.size,
    citiesVisited: cities.size,
    averageCoupleScore,
    scoredDateCount: ratedDates.length,
    highestRatedDate,
    lowestRatedDate,
    favoriteCategory: favoriteCategoryEntry
      ? {
          category: favoriteCategoryEntry[0],
          label: PLACE_CATEGORY_LABEL[favoriteCategoryEntry[0]],
          count: favoriteCategoryEntry[1],
        }
      : null,
    totalSpendCents: spendAgg._count._all > 0 ? (spendAgg._sum.amountCents ?? 0) : null,
    currency,
  };

  // --- Category preferences (part 3) + gaps (part 4) ---------------------
  const categoryPreferences = buildCategoryPreferences(scoreRows, memberRefs);
  const preferenceBreakdownVisible = hasPartner && !settings.hidePartnerPreferenceGap;
  const preferenceGaps = preferenceBreakdownVisible
    ? findPreferenceGaps(categoryPreferences, memberRefs, viewerId)
    : [];

  // --- Insights (part 5) ------------------------------------------------
  const topByScore = [...categoryPreferences]
    .filter((p) => p.coupleAvg != null)
    .sort((a, b) => (b.coupleAvg as number) - (a.coupleAvg as number) || b.sampleSize - a.sampleSize)[0];

  const revisitTop = [...revisitTypeTally.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];

  const activityTop = [...activityTally.values()]
    .map((e) => ({ label: e.label, count: e.dates.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))[0];

  const placeTop = [...placeVisitTally.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )[0];

  const spentDates = perDateSpend.filter((d) => d.spendCents > 0);
  const averageSpendCents =
    spentDates.length >= 2
      ? Math.round(spentDates.reduce((sum, d) => sum + d.spendCents, 0) / spentDates.length)
      : null;

  const valueCandidates = perDateSpend.filter(
    (d) => d.score != null && d.spendCents >= 500,
  );
  const bestValue =
    valueCandidates.length >= 2
      ? [...valueCandidates].sort(
          (a, b) =>
            (b.score as number) / b.spendCents - (a.score as number) / a.spendCents,
        )[0]
      : null;

  const insights = buildCoupleInsights({
    topCategoryByScore: topByScore
      ? { label: topByScore.label, avg: topByScore.coupleAvg as number }
      : null,
    mostRevisitedType:
      revisitTop && revisitTop[1] >= 2
        ? { label: PLACE_CATEGORY_LABEL[revisitTop[0]], count: revisitTop[1] }
        : null,
    bestValueDate: bestValue
      ? {
          title: bestValue.title,
          score: bestValue.score as number,
          spendLabel: formatMoney(bestValue.spendCents, currency),
        }
      : null,
    mostCommonActivity:
      activityTop && activityTop.count >= 2
        ? { title: activityTop.label, count: activityTop.count }
        : null,
    favoritePlace:
      placeTop && placeTop.count >= 2
        ? { name: placeTop.name, visits: placeTop.count }
        : null,
    averageSpendLabel:
      averageSpendCents != null ? formatMoney(averageSpendCents, currency) : null,
    moneyHidden: settings.hideMoneyInsights,
  });

  return {
    couple: {
      id: couple.id,
      name: couple.name,
      description: couple.description,
      photoUrl: couple.photoUrl,
      anniversaryAt: couple.anniversaryAt?.toISOString() ?? null,
      currency,
      createdAtIso: couple.createdAt.toISOString(),
    },
    members,
    statistics,
    categoryPreferences,
    preferenceBreakdownVisible,
    preferenceGaps,
    insights,
    moneyInsightsHidden: settings.hideMoneyInsights,
  };
}
