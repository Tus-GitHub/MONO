import { PlaceCategory } from "@prisma/client";
import { EXPLORE_CATEGORIES, exploreCategoryByKey } from "./explore-categories";

export const PLAN_CATEGORIES = EXPLORE_CATEGORIES.filter((category) => category.kind === "category");
/** Adventure and Nature are plan intents; their venue filters are Activities and Park. */
export function venueCategoryKey(key: string | null | undefined): string | null {
  if (key === "adventure") return "activities";
  if (key === "nature") return "park";
  return exploreCategoryByKey(key ?? undefined)?.kind === "category" ? key! : null;
}

const TITLE_CATEGORIES: [string, RegExp][] = [
  ["cafe", /\b(caf[eé]s?|coffee|dessert)\b/iu],
  ["restaurant", /\b(restaurants?|dinner|lunch|brunch|breakfast)\b/iu],
  ["bar", /\b(bars?|pubs?|cocktails?|drinks?)\b/iu],
  ["cinema", /\b(cinema|movies?|films?)\b/iu],
  ["museum", /\b(museums?|galler(?:y|ies))\b/iu],
  ["activities", /\b(adventures?|activit(?:y|ies)|bowling|climbing|kayaking|karting|pottery|arcade|games?|escape room)\b/iu],
  ["park", /\b(parks?|nature|picnic|hiking|walk|outdoors?)\b/iu],
  ["shopping", /\b(shopping|mall|markets?)\b/iu],
  ["staycation", /\b(staycation|hotel|stay|at home|road trip|travel|getaway)\b/iu],
];

/** Conservative whole-word matching: unknown titles leave the picker unfiltered. */
export function categoryFromPlanTitle(title: string): string | null {
  const normalized = title.normalize("NFKD").replace(/\p{M}/gu, "");
  const hits = TITLE_CATEGORIES.map(([key, pattern]) => ({ key, index: normalized.search(pattern) }))
    .filter((hit) => hit.index >= 0).sort((a, b) => a.index - b.index);
  return hits[0]?.key ?? null;
}

export const CATEGORY_SEARCH_TEXT: Partial<Record<PlaceCategory, string>> = {
  CAFE: "cafes", RESTAURANT: "restaurants", BAR: "bars", CINEMA: "cinemas",
  PARK: "parks", MUSEUM: "museums", ACTIVITY: "activities", SHOPPING: "shops", TRAVEL: "hotels",
};

/** Mixed categories such as Staycation can browse hotels while still including saved home dates. */
export function providerCategoryFor(categories: PlaceCategory[] | undefined): PlaceCategory | null {
  return categories?.find((category) => CATEGORY_SEARCH_TEXT[category]) ?? categories?.[0] ?? null;
}
