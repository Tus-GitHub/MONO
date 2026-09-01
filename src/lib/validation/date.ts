import { z } from "zod";
import {
  DateActivityKind,
  DateStatus,
  ExpenseCategory,
  ExpensePayer,
  ReviewRevisit,
  RevisitChoice,
} from "@prisma/client";

import { SCORE_MAX, SCORE_MIN } from "@/lib/review/scale";

import {
  amountCentsSchema,
  currencySchema,
  idSchema,
  optionalText,
  requiredText,
} from "@/lib/validation/common";

// --- shared field helpers for the Plan flow -------------------------------

const blankToUndef = (value: unknown) => (value === "" || value == null ? undefined : value);

/** A "HH:MM" 24h clock string, or nothing. */
const timeString = z.preprocess(
  blankToUndef,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM.")
    .optional(),
);

/** A real "YYYY-MM-DD" that is today or later. */
const futureDateString = z.preprocess(
  blankToUndef,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, "That date doesn't exist.")
    .refine((value) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(`${value}T00:00:00`).getTime() >= today.getTime();
    }, "Pick today or a future date.")
    .optional(),
);

/** Dollars in the form → integer cents (or undefined). */
const dollarsToCents = z
  .preprocess(
    blankToUndef,
    z.coerce
      .number()
      .nonnegative("That can't be negative.")
      .max(1_000_000, "That's more than MONO handles.")
      .optional(),
  )
  .transform((dollars) => (dollars == null ? undefined : Math.round(dollars * 100)));

/** A real "YYYY-MM-DD" — any day, past or future (for recording what actually happened). */
const wallDateString = z.preprocess(
  blankToUndef,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, "That date doesn't exist.")
    .optional(),
);

/** Dollars → integer cents, required and greater than zero (a real expense line). */
const requiredDollarsToCents = z
  .preprocess(
    blankToUndef,
    z.coerce
      .number({ invalid_type_error: "Enter an amount." })
      .positive("Enter an amount greater than zero.")
      .max(1_000_000, "That's more than MONO handles."),
  )
  .transform((dollars) => Math.round(dollars * 100));

/** Planning payload — the intent for a date. */
export const datePlanSchema = z.object({
  title: requiredText("Title", 160),
  notes: optionalText(4000),
  scheduledFor: z.coerce.date().optional(),
  plannedStartAt: z.coerce.date().optional(),
  plannedEndAt: z.coerce.date().optional(),
  plannedPlaceId: idSchema.optional(),
  expectedBudgetCents: amountCentsSchema.optional(),
  currency: currencySchema.optional(),
});

export const createDateSchema = datePlanSchema;
export const updateDatePlanSchema = datePlanSchema.partial();

/** Completion payload — what actually happened; may diverge from the plan. */
export const dateCompletionSchema = z.object({
  actualPlaceId: idSchema.optional(),
  actualLocationText: optionalText(300),
  actualStartAt: z.coerce.date().optional(),
  actualEndAt: z.coerce.date().optional(),
  actualSpendCents: amountCentsSchema.optional(),
});

export const dateActivitySchema = z.object({
  kind: z.nativeEnum(DateActivityKind).default(DateActivityKind.PLANNED),
  title: requiredText("Activity", 160),
  description: optionalText(2000),
  placeId: idSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  costCents: amountCentsSchema.optional(),
});

export const revisitDecisionSchema = z.object({
  choice: z.nativeEnum(RevisitChoice),
  reason: optionalText(1000),
  targetTimeframe: optionalText(120),
});

export const transitionDateSchema = z.object({
  to: z.nativeEnum(DateStatus),
  cancelReason: optionalText(500),
});

// --- Plan-a-Date flow ---------------------------------------------------------

/** Step 1 — draft-lenient basics. Times need a date; end must be after start. */
export const dateBasicsSchema = z
  .object({
    title: z.string().trim().max(160, "Keep the title under 160 characters.").optional(),
    date: futureDateString,
    startTime: timeString,
    endTime: timeString,
    notes: optionalText(4000),
  })
  .refine((v) => !(v.startTime && v.endTime) || v.endTime > v.startTime, {
    message: "The end time needs to be after the start time.",
    path: ["endTime"],
  })
  .refine((v) => !((v.startTime || v.endTime) && !v.date), {
    message: "Pick a date before choosing a time.",
    path: ["date"],
  });

/** Step 2 — budget. Financial info is optional and secondary. */
export const dateBudgetSchema = z
  .object({
    expectedTotal: dollarsToCents,
    budgetMin: dollarsToCents,
    budgetMax: dollarsToCents,
    currency: currencySchema.optional(),
    split: z.nativeEnum(ExpensePayer).default(ExpensePayer.SHARED),
  })
  .refine((v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax, {
    message: "The low end can't be more than the high end.",
    path: ["budgetMax"],
  });

/** A single planned activity in the flow. */
export const plannedActivitySchema = z.object({
  title: requiredText("Activity", 120),
  durationMinutes: z.preprocess(
    blankToUndef,
    z.coerce.number().int().min(5).max(1440).optional(),
  ),
  costCents: dollarsToCents,
  savedPlaceId: z.preprocess(blankToUndef, idSchema.optional()),
});

export const reorderActivitiesSchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(idSchema).min(1).max(50)),
});

// --- "How did it actually go?" ---------------------------------------------

/**
 * What actually happened. Every field is optional and free to diverge completely from the
 * plan — a saved place *or* free text for where you really ended up, the real times, the real
 * spend, and a note. Times need a day, and the end can't precede the start.
 */
export const dateActualsSchema = z
  .object({
    actualSavedPlaceId: z.preprocess(blankToUndef, idSchema.optional()),
    actualLocationText: optionalText(300),
    actualDate: wallDateString,
    actualStartTime: timeString,
    actualEndTime: timeString,
    actualSpend: dollarsToCents,
    actualNotes: optionalText(4000),
  })
  .refine((v) => !(v.actualStartTime && v.actualEndTime) || v.actualEndTime > v.actualStartTime, {
    message: "The end time needs to be after the start time.",
    path: ["actualEndTime"],
  })
  .refine((v) => !((v.actualStartTime || v.actualEndTime) && !v.actualDate), {
    message: "Pick the day before choosing a time.",
    path: ["actualDate"],
  });

/** One thing you actually did. `unplanned` marks a detour / extra stop that wasn't planned. */
export const actualActivitySchema = z.object({
  title: requiredText("Activity", 160),
  unplanned: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean().default(false)),
  costCents: dollarsToCents,
  note: optionalText(500),
});

// --- Blind individual review -------------------------------------------------

/** A single 1–10 score. Category scores arrive as `score:<categoryId>` fields. */
export const reviewScore = z
  .coerce.number()
  .int("Use a whole number.")
  .min(SCORE_MIN, `Scores run ${SCORE_MIN}–${SCORE_MAX}.`)
  .max(SCORE_MAX, `Scores run ${SCORE_MIN}–${SCORE_MAX}.`);

const reflectionFields = {
  lovedText: optionalText(4000),
  betterText: optionalText(4000),
  rememberText: optionalText(4000),
  unexpectedText: optionalText(4000),
} as const;

/** Saving a private draft — nothing is required, half-answers are fine. */
export const reviewDraftSchema = z.object({
  overallRating: z.preprocess(blankToUndef, reviewScore.optional()),
  personalRevisit: z.preprocess(blankToUndef, z.nativeEnum(ReviewRevisit).optional()),
  personalRevisitNote: optionalText(1000),
  ...reflectionFields,
});

/** Locking your side in — the overall score and the revisit call are the two commitments. */
export const reviewSubmitSchema = z.object({
  overallRating: reviewScore,
  personalRevisit: z.nativeEnum(ReviewRevisit, {
    errorMap: () => ({ message: "Pick one of the four." }),
  }),
  personalRevisitNote: optionalText(1000),
  ...reflectionFields,
});

export const dateMemorySchema = z.object({
  title: requiredText("Title", 160),
  body: requiredText("A few words", 8000),
  coverPhotoId: z.preprocess(blankToUndef, idSchema.optional()),
  isFavorite: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean().default(false)),
});

/**
 * A spend line attached to a date — quick-add and later edits share this. `payer` is
 * viewer-relative ("me" is whoever is filling the form); the service translates it to a
 * canonical `ExpensePayer` + owner share using the actor's couple role.
 */
export const dateExpenseSchema = z.object({
  description: requiredText("Description", 200),
  amount: requiredDollarsToCents,
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.OTHER),
  payer: z.enum(["me", "partner", "shared", "custom"]).default("shared"),
  /** the acting person's own share, 0–100, only used when payer = "custom". */
  mySharePct: z.preprocess(
    blankToUndef,
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  note: optionalText(500),
  spentAt: z.preprocess(blankToUndef, z.coerce.date().optional()),
  currency: currencySchema.optional(),
});

export const photoCaptionSchema = z.object({
  caption: optionalText(300),
});

export type DatePlanInput = z.infer<typeof datePlanSchema>;
export type DateCompletionInput = z.infer<typeof dateCompletionSchema>;
export type DateActivityInput = z.infer<typeof dateActivitySchema>;
export type TransitionDateInput = z.infer<typeof transitionDateSchema>;
export type DateBasicsInput = z.infer<typeof dateBasicsSchema>;
export type DateBudgetInput = z.infer<typeof dateBudgetSchema>;
export type PlannedActivityInput = z.infer<typeof plannedActivitySchema>;
export type DateActualsInput = z.infer<typeof dateActualsSchema>;
export type ActualActivityInput = z.infer<typeof actualActivitySchema>;
export type ReviewDraftInput = z.infer<typeof reviewDraftSchema>;
export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;
export type DateMemoryInput = z.infer<typeof dateMemorySchema>;
export type DateExpenseInput = z.infer<typeof dateExpenseSchema>;
export type RevisitDecisionInput = z.infer<typeof revisitDecisionSchema>;
