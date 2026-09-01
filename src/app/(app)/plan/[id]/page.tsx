import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActivitiesStep } from "@/components/plan/activities-step";
import { BasicsStep } from "@/components/plan/basics-step";
import { BudgetStep } from "@/components/plan/budget-step";
import { ReviewStep } from "@/components/plan/review-step";
import { isPlanStep } from "@/lib/date/plan-steps";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { getPlan, listSavedPlaceOptions } from "@/server/services/plan-service";

export const metadata: Metadata = { title: "Plan a date" };

export default async function PlanFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  await requireOnboarded();
  const { id } = await params;
  const { step: rawStep } = await searchParams;
  const step = isPlanStep(rawStep) ? rawStep : "basics";

  let plan;
  try {
    plan = await getPlan(id);
  } catch (error) {
    if (isAppError(error)) redirect(`/dates/${id}`);
    throw error;
  }

  const savedPlaces = step === "activities" ? await listSavedPlaceOptions() : [];

  return (
    <div className="mx-auto max-w-xl">
      {step === "basics" ? <BasicsStep plan={plan} /> : null}
      {step === "budget" ? <BudgetStep plan={plan} /> : null}
      {step === "activities" ? <ActivitiesStep plan={plan} savedPlaces={savedPlaces} /> : null}
      {step === "review" ? <ReviewStep plan={plan} /> : null}
    </div>
  );
}
