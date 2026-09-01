import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DateStatus } from "@prisma/client";

import { ActualActivitiesEditor } from "@/components/dates/actual-activities-editor";
import { RecapForm } from "@/components/dates/recap-form";
import { PageHeader } from "@/components/layout/page-header";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { listActualActivities } from "@/server/services/actuals-service";
import { getDateExperience } from "@/server/services/date-service";
import { listSavedPlaceOptions } from "@/server/services/plan-service";

export const metadata: Metadata = { title: "How did it go?" };

const RECORDABLE: DateStatus[] = [
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

export default async function RecapPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireOnboarded();
  const { id } = await params;

  let data;
  try {
    data = await getDateExperience(id, user.id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }
  if (!RECORDABLE.includes(data.date.status)) redirect(`/dates/${id}`);

  const [savedPlaces, activities] = await Promise.all([
    listSavedPlaceOptions(),
    listActualActivities(id),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        title="How did it actually go?"
        description="What really happened — free to look nothing like the plan."
        back={{ href: `/dates/${id}`, label: data.date.title || "Back to the date" }}
      />

      <RecapForm
        dateId={id}
        plan={{
          placeName: data.plan.placeName,
          dateYmd: data.plan.dateYmd,
          startTime: data.plan.startTime,
          endTime: data.plan.endTime,
          budgetCents: data.plan.budgetCents,
        }}
        actual={{
          placeId: data.actual.placeId,
          locationText: data.actual.locationText,
          dateYmd: data.actual.dateYmd,
          startTime: data.actual.startTime,
          endTime: data.actual.endTime,
          spendCents: data.actual.spendCents,
          notes: data.actual.notes,
        }}
        savedPlaces={savedPlaces}
      />

      <div className="border-t border-line pt-6">
        <ActualActivitiesEditor
          dateId={id}
          activities={activities}
          hasPlan={data.plan.activities.length > 0}
          currency={data.date.currency}
        />
      </div>
    </div>
  );
}
