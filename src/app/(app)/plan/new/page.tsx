import type { Metadata } from "next";
import { NewPlanEditor } from "@/components/plan/new-plan-editor";
import { emptyLocalPlan } from "@/lib/date/local-plan";
import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { getPlan, listSavedPlaceOptions } from "@/server/services/plan-service";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "New date plan" };
export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ idea?: string; place?: string; copy?: string }> }) {
  const { user, couple } = await requireCoupleContext();
  const params = await searchParams;
  const initial = emptyLocalPlan(couple.currency, params.idea?.slice(0, 160));
  if (params.place) {
    const place = await prisma.place.findFirst({ where: { id: params.place, coupleId: couple.id, deletedAt: null }, select: { id: true, name: true, city: true, address: true, imageUrl: true } });
    if (!place) throw new NotFoundError("That venue isn't in your space.");
    initial.place = { ...place, selection: { mode: "saved", savedPlaceId: place.id } };
  }
  if (params.copy) {
    const source = await getPlan(params.copy);
    initial.title = `${source.title} (copy)`.slice(0, 160);
    initial.notes = source.notes ?? "";
    initial.category = source.discoveryCategory ?? "";
    initial.expectedTotal = source.expectedTotalCents == null ? "" : String(source.expectedTotalCents / 100);
    initial.budgetMin = source.budgetMinCents == null ? "" : String(source.budgetMinCents / 100);
    initial.budgetMax = source.budgetMaxCents == null ? "" : String(source.budgetMaxCents / 100);
    initial.currency = source.currency; initial.split = source.budgetSplit;
    initial.place = source.place ? { name: source.place.name, selection: { mode: "saved", savedPlaceId: source.place.id } } : null;
    initial.activities = source.activities.map((activity) => ({ key: activity.id, title: activity.title,
      duration: activity.durationMinutes ? String(activity.durationMinutes) : "", cost: activity.costCents == null ? "" : String(activity.costCents / 100), savedPlaceId: activity.placeId ?? "" }));
  }
  return <div className="mx-auto max-w-xl"><NewPlanEditor initial={initial} userId={user.id} coupleId={couple.id}
    timezone={couple.timezone} savedPlaces={await listSavedPlaceOptions()} /></div>;
}
