import { PlaceCategory, RevisitChoice } from "@prisma/client";

/** Parsed, validated state of the history list — filters + search + view, all URL-driven. */
export interface HistoryQuery {
  q: string;
  year: number | null;
  month: number | null; // 1–12
  category: PlaceCategory | null;
  placeId: string | null;
  city: string | null;
  activity: string;
  revisit: RevisitChoice | null;
  minScore: number | null; // 7 | 8 | 9
  view: HistoryView;
}

export type HistoryView = "timeline" | "grid" | "list";

export const SCORE_BUCKETS: { value: number | null; label: string }[] = [
  { value: null, label: "Any score" },
  { value: 7, label: "7 and up" },
  { value: 8, label: "8 and up" },
  { value: 9, label: "9 and up" },
];

const isCategory = (v: string): v is PlaceCategory =>
  (Object.values(PlaceCategory) as string[]).includes(v);
const isRevisit = (v: string): v is RevisitChoice =>
  (Object.values(RevisitChoice) as string[]).includes(v);

export function parseHistoryParams(
  sp: Record<string, string | string[] | undefined>,
): HistoryQuery {
  const one = (key: string): string | undefined => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const num = (key: string): number | null => {
    const parsed = Number(one(key));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const year = num("year");
  const month = num("month");
  const categoryRaw = one("category");
  const revisitRaw = one("revisit");
  const viewRaw = one("view");

  return {
    q: (one("q") ?? "").trim().slice(0, 120),
    year: year && year >= 2000 && year <= 2100 ? Math.trunc(year) : null,
    month: month && month >= 1 && month <= 12 ? Math.trunc(month) : null,
    category: categoryRaw && isCategory(categoryRaw) ? categoryRaw : null,
    placeId: one("place")?.trim() || null,
    city: one("city")?.trim() || null,
    activity: (one("activity") ?? "").trim().slice(0, 80),
    revisit: revisitRaw && isRevisit(revisitRaw) ? revisitRaw : null,
    minScore: [7, 8, 9].includes(num("score") ?? 0) ? num("score") : null,
    view: viewRaw === "grid" || viewRaw === "list" ? viewRaw : "timeline",
  };
}

/** True when anything other than the view / free-text search is narrowing the list. */
export function hasActiveFilters(query: HistoryQuery): boolean {
  return Boolean(
    query.year ||
      query.month ||
      query.category ||
      query.placeId ||
      query.city ||
      query.activity ||
      query.revisit ||
      query.minScore,
  );
}

/** Serialise a (partial) query to a querystring, dropping empty values. */
export function historyParamsToString(query: Partial<HistoryQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.year) params.set("year", String(query.year));
  if (query.month) params.set("month", String(query.month));
  if (query.category) params.set("category", query.category);
  if (query.placeId) params.set("place", query.placeId);
  if (query.city) params.set("city", query.city);
  if (query.activity) params.set("activity", query.activity);
  if (query.revisit) params.set("revisit", query.revisit);
  if (query.minScore) params.set("score", String(query.minScore));
  if (query.view && query.view !== "timeline") params.set("view", query.view);
  const string = params.toString();
  return string ? `?${string}` : "";
}
