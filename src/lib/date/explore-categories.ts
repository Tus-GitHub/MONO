import { PlaceCategory } from "@prisma/client";

import type { IconName } from "@/components/ui/icon";

export type ExploreKind = "category" | "curated" | "custom";

export interface ExploreCategory {
  key: string;
  label: string;
  icon: IconName;
  /** Tailwind classes for the card's tinted face. */
  tint: string;
  kind: ExploreKind;
  /** DB categories this browse-category maps to (for `kind: "category"`). */
  match: PlaceCategory[];
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { key: "cafe", label: "Café", icon: "mapPin", tint: "bg-primary-tint text-primary", kind: "category", match: [PlaceCategory.CAFE] },
  { key: "restaurant", label: "Restaurant", icon: "mapPin", tint: "bg-primary-tint text-primary", kind: "category", match: [PlaceCategory.RESTAURANT] },
  { key: "cinema", label: "Cinema", icon: "images", tint: "bg-accent-tint text-accent", kind: "category", match: [PlaceCategory.CINEMA] },
  { key: "park", label: "Park", icon: "compass", tint: "bg-success-tint text-success", kind: "category", match: [PlaceCategory.PARK] },
  { key: "museum", label: "Museum", icon: "images", tint: "bg-accent-tint text-accent", kind: "category", match: [PlaceCategory.MUSEUM] },
  { key: "adventure", label: "Adventure", icon: "compass", tint: "bg-success-tint text-success", kind: "category", match: [PlaceCategory.ACTIVITY] },
  { key: "shopping", label: "Shopping", icon: "mapPin", tint: "bg-warning-tint text-warning", kind: "category", match: [PlaceCategory.SHOPPING] },
  { key: "nature", label: "Nature", icon: "compass", tint: "bg-success-tint text-success", kind: "category", match: [PlaceCategory.PARK] },
  { key: "activities", label: "Activities", icon: "sparkles", tint: "bg-accent-tint text-accent", kind: "category", match: [PlaceCategory.ACTIVITY] },
  { key: "staycation", label: "Staycation", icon: "home", tint: "bg-primary-tint text-primary", kind: "category", match: [PlaceCategory.HOME, PlaceCategory.TRAVEL] },
  { key: "hidden", label: "Hidden gems", icon: "sparkles", tint: "bg-ink text-primary-fg", kind: "curated", match: [] },
  { key: "custom", label: "Custom place", icon: "plus", tint: "border border-dashed border-line-strong text-muted", kind: "custom", match: [] },
];

export function exploreCategoryByKey(key: string | undefined): ExploreCategory | undefined {
  return EXPLORE_CATEGORIES.find((category) => category.key === key);
}
