import type { PlaceCategory, RevisitChoice } from "@prisma/client";

import type { CoverImage } from "@/lib/date/photo-view";

/**
 * One completed date, flattened for the history views. Every derived value (couple score,
 * reveal state, memory snippet) is computed once in `history-service`; the card components
 * are pure presentation and share this single shape.
 */
export interface DateHistoryItem {
  id: string;
  title: string;
  /** The day the date happened — actual start, else the scheduled day. */
  dateYmd: string | null;
  completedAtIso: string | null;
  year: number | null;

  placeId: string | null;
  placeName: string | null;
  placeCity: string | null;
  placeCategory: PlaceCategory | null;
  placeCategoryLabel: string | null;
  placeIsFavorite: boolean;

  cover: CoverImage | null;
  photoCount: number;

  /** null until both reviews have revealed. */
  coupleScore: number | null;
  reviewRevealed: boolean;

  /** The couple's shared revisit call, if they made one. */
  revisit: RevisitChoice | null;

  hasMemory: boolean;
  memoryId: string | null;
  memoryIsFavorite: boolean;
  memoryTitle: string | null;
  memorySnippet: string | null;

  spendCents: number | null;
  currency: string;

  activityTitles: string[];
}

export function memorySnippet(text: string | null | undefined, max = 150): string | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
