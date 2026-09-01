/**
 * The rating dimensions every couple starts with (created with `isSystem = true`), scored 1–10.
 * Plain data with no server-only imports, so the Prisma seed script can use it too.
 */
export const DEFAULT_REVIEW_CATEGORIES = [
  { key: "food", label: "Food", description: "Anything you ate or drank" },
  { key: "ambience", label: "Ambience", description: "Mood, décor, music, lighting" },
  { key: "hygiene", label: "Hygiene", description: "How clean and cared-for it felt" },
  { key: "adventure", label: "Adventure", description: "How far out of the routine it took you" },
  { key: "fun", label: "Fun", description: "How much fun you actually had" },
  { key: "value", label: "Value for money", description: "Whether it felt worth what it cost" },
] as const;

export type DefaultReviewCategory = (typeof DEFAULT_REVIEW_CATEGORIES)[number];
