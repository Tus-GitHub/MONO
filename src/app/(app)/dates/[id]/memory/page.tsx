import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MemoryForm } from "@/components/dates/memory-form";
import { PageHeader } from "@/components/layout/page-header";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { getMemoryContext } from "@/server/services/memory-service";

export const metadata: Metadata = { title: "Keep the memory" };

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOnboarded();
  const { id } = await params;

  let context;
  try {
    context = await getMemoryContext(id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }
  if (!context.memorable) redirect(`/dates/${id}`);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={context.memory ? "Edit the memory" : "Keep it as a memory"}
        description="The version of this date you'll want to reread in a year."
        back={{ href: `/dates/${id}`, label: context.dateTitle || "Back to the date" }}
      />
      <MemoryForm
        dateId={id}
        dateTitle={context.dateTitle}
        photos={context.photos}
        memory={context.memory}
      />
    </div>
  );
}
