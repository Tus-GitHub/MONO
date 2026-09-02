import { PlaceCategory } from "@prisma/client";

import type { IconName } from "@/components/ui/icon";

/**
 * Non-place date ideas — a fixed, hand-written catalogue. Each idea names a `category` so the
 * recommendation engine can score it against the couple's place-category history, and carries
 * the copy the card renders. Pure data; no place lookup.
 */
export interface DateIdea {
  key: string;
  title: string;
  blurb: string;
  category: PlaceCategory;
  icon: IconName;
  /** Rough effort/planning weight — used only for a secondary sort, never shown as a number. */
  effort: "low" | "medium" | "high";
}

export const DATE_IDEAS: DateIdea[] = [
  {
    key: "picnic",
    title: "Picnic",
    blurb: "Pack something good, find a patch of grass, stay until it gets cold.",
    category: PlaceCategory.PARK,
    icon: "compass",
    effort: "low",
  },
  {
    key: "pottery",
    title: "Pottery class",
    blurb: "Make something lopsided together and keep it forever.",
    category: PlaceCategory.ACTIVITY,
    icon: "sparkles",
    effort: "medium",
  },
  {
    key: "movie-night",
    title: "Movie night",
    blurb: "One pick each, no vetoes. Snacks are mandatory.",
    category: PlaceCategory.CINEMA,
    icon: "images",
    effort: "low",
  },
  {
    key: "museum",
    title: "Museum wander",
    blurb: "One wing, slowly. Skip the gift shop, or don't.",
    category: PlaceCategory.MUSEUM,
    icon: "images",
    effort: "low",
  },
  {
    key: "cooking-class",
    title: "Cooking class",
    blurb: "Learn one dish you'll actually make again at home.",
    category: PlaceCategory.ACTIVITY,
    icon: "sparkles",
    effort: "medium",
  },
  {
    key: "road-trip",
    title: "Road trip",
    blurb: "Pick a town an hour away and see what it's got.",
    category: PlaceCategory.TRAVEL,
    icon: "compass",
    effort: "high",
  },
  {
    key: "cafe-hopping",
    title: "Café hopping",
    blurb: "Three cafés, one drink each, rank them at the end.",
    category: PlaceCategory.CAFE,
    icon: "mapPin",
    effort: "low",
  },
  {
    key: "sunset-walk",
    title: "Sunset walk",
    blurb: "Somewhere with a view, timed so the sky does the work.",
    category: PlaceCategory.PARK,
    icon: "compass",
    effort: "low",
  },
  {
    key: "adventure-activity",
    title: "Adventure activity",
    blurb: "Climbing, kayaking, karting — something with a little adrenaline.",
    category: PlaceCategory.ACTIVITY,
    icon: "compass",
    effort: "high",
  },
  {
    key: "photography-walk",
    title: "Photography walk",
    blurb: "One roll of film or 20 photos max. Best shot wins.",
    category: PlaceCategory.PARK,
    icon: "camera",
    effort: "low",
  },
];

export const DATE_IDEA_BY_KEY: Record<string, DateIdea> = Object.fromEntries(
  DATE_IDEAS.map((idea) => [idea.key, idea]),
);
