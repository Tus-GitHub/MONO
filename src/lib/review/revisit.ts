import { ReviewRevisit } from "@prisma/client";

/** The four independent "would you do this again?" answers, in intensity order. */
export const REVIEW_REVISIT_ORDER: ReviewRevisit[] = [
  ReviewRevisit.DEFINITELY,
  ReviewRevisit.MAYBE,
  ReviewRevisit.PROBABLY_NOT,
  ReviewRevisit.NEVER_AGAIN,
];

export const REVIEW_REVISIT_META: Record<
  ReviewRevisit,
  { label: string; hint: string; tone: "high" | "mid" | "low" }
> = {
  DEFINITELY: { label: "Definitely", hint: "Already want to go back", tone: "high" },
  MAYBE: { label: "Maybe", hint: "Under the right mood", tone: "mid" },
  PROBABLY_NOT: { label: "Probably not", hint: "Wouldn't seek it out", tone: "low" },
  NEVER_AGAIN: { label: "Never again", hint: "One and done", tone: "low" },
};
