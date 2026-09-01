/**
 * The post-date pipeline — the loose checklist a completed date invites the couple to work
 * through: photos, each person's review, the revisit call, and the memory. Nothing here is
 * mandatory and nothing has to happen at once; this only computes what's left to do.
 */

export type PipelineStepKey =
  | "recap"
  | "photos"
  | "bestPhoto"
  | "review"
  | "partnerReview"
  | "revisit"
  | "memory";

export interface PipelineStep {
  key: PipelineStepKey;
  label: string;
  hint: string;
  done: boolean;
  /** Something the *other* person owns — shown for completeness, not a to-do for you. */
  waiting: boolean;
  /** Path relative to `/dates/[id]`, or `null` when the step is handled inline on the page. */
  to: string | null;
}

export interface Pipeline {
  steps: PipelineStep[];
  doneCount: number;
  total: number;
  complete: boolean;
}

export function buildPipeline(input: {
  dateId: string;
  actualsRecorded: boolean;
  photoCount: number;
  bestPhotoSet: boolean;
  myReview: boolean;
  partnerReview: boolean;
  hasPartner: boolean;
  revisitDecided: boolean;
  hasMemory: boolean;
}): Pipeline {
  const base = `/dates/${input.dateId}`;

  const steps: PipelineStep[] = [
    {
      key: "recap",
      label: "What actually happened",
      hint: input.actualsRecorded ? "Recorded — edit anytime" : "The real place, times and spend",
      done: input.actualsRecorded,
      waiting: false,
      to: `${base}/recap`,
    },
    {
      key: "photos",
      label: "Add photos",
      hint:
        input.photoCount > 0
          ? `${input.photoCount} added — add more whenever`
          : "The pictures you took",
      done: input.photoCount > 0,
      waiting: false,
      to: null,
    },
  ];

  // Only worth asking once there are photos to choose between.
  if (input.photoCount > 0) {
    steps.push({
      key: "bestPhoto",
      label: "Pick your best photo",
      hint: input.bestPhotoSet
        ? "Chosen — change anytime"
        : "The one that feels most like you",
      done: input.bestPhotoSet,
      waiting: false,
      to: null,
    });
  }

  steps.push({
    key: "review",
    label: "Your review",
    hint: input.myReview
      ? "Submitted — private until you've both submitted"
      : "How it felt to you, on your own",
    done: input.myReview,
    waiting: false,
    to: `${base}/review`,
  });

  if (input.hasPartner) {
    steps.push({
      key: "partnerReview",
      label: "Their review",
      hint: input.partnerReview ? "Submitted" : "Waiting for their side of the story",
      done: input.partnerReview,
      waiting: !input.partnerReview,
      to: null,
    });
  }

  steps.push(
    {
      key: "revisit",
      label: "Would you go again?",
      hint: input.revisitDecided ? "Decided — change anytime" : "Yes, maybe, or never again",
      done: input.revisitDecided,
      waiting: false,
      to: null,
    },
    {
      key: "memory",
      label: "Keep it as a memory",
      hint: input.hasMemory ? "Saved — edit anytime" : "Turn this date into a story",
      done: input.hasMemory,
      waiting: false,
      to: `${base}/memory`,
    },
  );

  const actionable = steps.filter((step) => !step.waiting);
  const doneCount = actionable.filter((step) => step.done).length;

  return {
    steps,
    doneCount,
    total: actionable.length,
    complete: doneCount === actionable.length,
  };
}
