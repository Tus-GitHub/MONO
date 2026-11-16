import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewPlanEditor } from "@/components/plan/new-plan-editor";
import { requireCoupleContext } from "@/lib/authz";
import { emptyLocalPlan } from "@/lib/date/local-plan";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { getPlan, listSavedPlaceOptions } from "@/server/services/plan-service";

export const metadata: Metadata = { title: "Edit date plan" };

export default async function PlanFlowPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOnboarded();
  const { user, couple, membership } = await requireCoupleContext();
  const { id } = await params;
  let plan;
  try { plan = await getPlan(id); }
  catch (error) { if (isAppError(error)) redirect(`/dates/${id}`); throw error; }
  const initial = emptyLocalPlan(plan.currency, plan.title);
  const money = (value: number | null) => value == null ? "" : String(value / 100);
  const place = (id: string | null, name: string | null) => id ? { name: name || "Saved place", selection: { mode: "saved" as const, savedPlaceId: id } } : null;
  Object.assign(initial, {
    category: plan.discoveryCategory ?? "", date: plan.date ?? "", startTime: plan.startTime ?? "", endTime: plan.endTime ?? "",
    notes: plan.notes ?? "", expectedTotal: money(plan.expectedTotalCents), budgetMin: money(plan.budgetMinCents), budgetMax: money(plan.budgetMaxCents),
    split: plan.budgetSplit, place: place(plan.place?.id ?? null, plan.place?.name ?? null),
  });
  initial.activities = plan.activities.map((event) => ({ key: event.id, title: event.title, description: event.description ?? "",
    duration: String(event.durationMinutes ?? ""), cost: money(event.costCents), savedPlaceId: event.placeId ?? "",
    place: place(event.placeId, event.placeName), startTime: event.startTime ?? "", endTime: event.endTime ?? "" }));
  return <div className="mx-auto w-full min-w-0 max-w-2xl"><NewPlanEditor initial={initial} userId={user.id} coupleId={couple.id} myRole={membership.role}
    timezone={couple.timezone} existing={{ id, version: plan.version, status: plan.status }} savedPlaces={await listSavedPlaceOptions()} /></div>;
}
