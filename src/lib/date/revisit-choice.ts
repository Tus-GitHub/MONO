import { RevisitChoice } from "@prisma/client";

/** The couple's one shared "would we do this again?" call (`RevisitDecision.choice`). */
export const REVISIT_CHOICE_META: Record<
  RevisitChoice,
  { label: string; short: string; tone: "high" | "mid" | "low"; className: string }
> = {
  YES: {
    label: "You'd go back",
    short: "Going back",
    tone: "high",
    className: "bg-success-tint text-success",
  },
  MAYBE: {
    label: "Maybe again",
    short: "Maybe",
    tone: "mid",
    className: "bg-warning-tint text-warning",
  },
  NO: {
    label: "Been there, done that",
    short: "Been there",
    tone: "low",
    className: "bg-line/60 text-muted",
  },
};

export const REVISIT_CHOICE_ORDER: RevisitChoice[] = [
  RevisitChoice.YES,
  RevisitChoice.MAYBE,
  RevisitChoice.NO,
];
