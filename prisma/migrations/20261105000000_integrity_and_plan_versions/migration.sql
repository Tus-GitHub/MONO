-- All safeguards apply together, or the migration leaves the prior schema intact.
BEGIN;

ALTER TABLE "dates" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "date_review_ratings" ADD CONSTRAINT "review_score_range" CHECK ("score" BETWEEN 1 AND 10);
ALTER TABLE "date_reviews"
  ADD CONSTRAINT "review_overall_range" CHECK ("overallRating" IS NULL OR "overallRating" BETWEEN 1 AND 10),
  ADD CONSTRAINT "review_suggested_range" CHECK ("suggestedOverall" IS NULL OR "suggestedOverall" BETWEEN 1 AND 10),
  ADD CONSTRAINT "submitted_review_has_overall" CHECK ("submittedAt" IS NULL OR "overallRating" IS NOT NULL);
ALTER TABLE "expenses"
  ADD CONSTRAINT "expense_nonnegative" CHECK ("amountCents" >= 0),
  ADD CONSTRAINT "expense_custom_share" CHECK (
    "paidBy" <> 'CUSTOM' OR ("ownerShareCents" IS NOT NULL AND "ownerShareCents" BETWEEN 0 AND "amountCents")
  );
ALTER TABLE "dates"
  ADD CONSTRAINT "date_budget_nonnegative" CHECK (
    ("expectedBudgetCents" IS NULL OR "expectedBudgetCents" >= 0)
    AND ("expectedBudgetMinCents" IS NULL OR "expectedBudgetMinCents" >= 0)
    AND ("expectedBudgetMaxCents" IS NULL OR "expectedBudgetMaxCents" >= 0)
    AND ("actualSpendCents" IS NULL OR "actualSpendCents" >= 0)
  ),
  ADD CONSTRAINT "date_budget_range" CHECK ("expectedBudgetMinCents" <= "expectedBudgetMaxCents"),
  ADD CONSTRAINT "date_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "date_activities"
  ADD CONSTRAINT "activity_cost_nonnegative" CHECK ("costCents" IS NULL OR "costCents" >= 0),
  ADD CONSTRAINT "activity_duration_positive" CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0);
ALTER TABLE "places" ADD CONSTRAINT "place_coordinates_valid" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL)
  OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
);

-- Preflight existing membership data before applying; archived spaces should have LEFT memberships.
CREATE UNIQUE INDEX "couple_members_one_active_space" ON "couple_members" ("userId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "couple_members_one_active_role" ON "couple_members" ("coupleId", "role") WHERE "status" = 'ACTIVE';

COMMIT;
