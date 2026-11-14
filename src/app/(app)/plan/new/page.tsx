import type { Metadata } from "next";
import { NewPlanEditor } from "@/components/plan/new-plan-editor";
import { emptyLocalPlan } from "@/lib/date/local-plan";
import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { listSavedPlaceOptions } from "@/server/services/plan-service";
import { getPlanTemplate } from "@/server/services/plan-template-service";
import { RecreatePlanEditor } from "@/components/plan/recreate-plan-editor";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "New date plan" };
export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ idea?: string; place?: string; copy?: string; recreate?: string }> }) {
  const { user, couple } = await requireCoupleContext();
  const params = await searchParams;
  let initial = emptyLocalPlan(couple.currency, params.idea?.slice(0, 160));
  if (params.place) {
    const place = await prisma.place.findFirst({ where: { id: params.place, coupleId: couple.id, deletedAt: null }, select: { id: true, name: true, city: true, address: true, imageUrl: true } });
    if (!place) throw new NotFoundError("That venue isn't in your space.");
    initial.place = { ...place, selection: { mode: "saved", savedPlaceId: place.id } };
  }
  if (params.copy) initial = await getPlanTemplate(params.copy);
  if (params.recreate) {
    initial = await getPlanTemplate(params.recreate, true);
    return <div className="mx-auto max-w-xl"><RecreatePlanEditor initial={initial} sourceId={params.recreate} userId={user.id} coupleId={couple.id} timezone={couple.timezone} /></div>;
  }
  return <div className="mx-auto max-w-xl"><NewPlanEditor initial={initial} userId={user.id} coupleId={couple.id}
    timezone={couple.timezone} savedPlaces={await listSavedPlaceOptions()} /></div>;
}
