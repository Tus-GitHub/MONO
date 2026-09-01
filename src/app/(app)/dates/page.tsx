import type { Metadata } from "next";

import { DatesNav } from "@/components/dates/dates-nav";
import { DayDetailPanel } from "@/components/dates/day-detail-panel";
import { MarkDatesSeen } from "@/components/dates/mark-seen";
import { MonthCalendar } from "@/components/dates/month-calendar";
import { PageHeader } from "@/components/layout/page-header";
import { PlanDateButton } from "@/components/navigation/plan-date-button";
import { requireOnboarded } from "@/lib/onboarding";
import { getDayDates, getMonthDates } from "@/server/services/calendar-service";

export const metadata: Metadata = { title: "Our calendar" };

export default async function DatesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  await requireOnboarded();
  const { month: rawMonth, day: rawDay } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const month = /^\d{4}-\d{2}$/.test(rawMonth ?? "") ? rawMonth! : today.slice(0, 7);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay ?? "") ? rawDay! : today;

  const [monthDates, dayDates] = await Promise.all([getMonthDates(month), getDayDates(day)]);

  return (
    <div className="space-y-6">
      <MarkDatesSeen />
      <PageHeader
        title="Our calendar"
        description="Everything you've planned and lived through, by the day."
        action={<DatesNav />}
      />

      <MonthCalendar month={month} selectedDay={day} dates={monthDates} />

      <DayDetailPanel day={day} dates={dayDates} />

      <div className="flex justify-center">
        <PlanDateButton />
      </div>
    </div>
  );
}
