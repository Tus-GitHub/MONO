import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReviewForm } from "@/components/dates/review-form";
import { ReviewWaiting } from "@/components/dates/review-waiting";
import { PageHeader } from "@/components/layout/page-header";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import { getReviewContext } from "@/server/services/review-service";

export const metadata: Metadata = { title: "Your review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireOnboarded();
  const { id } = await params;

  let ctx;
  try {
    ctx = await getReviewContext(id, user.id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }
  if (!ctx.reviewable) redirect(`/dates/${id}`);
  // Once both sides are in, the reveal lives on the date page.
  if (ctx.stage === "revealed") redirect(`/dates/${id}`);

  const waiting = ctx.stage === "submitted";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={waiting ? "Your side is in" : ctx.myReview ? "Your review" : "How was it, really?"}
        description={
          waiting
            ? "Private until you've both submitted."
            : "Filled in on your own — your partner writes theirs separately, and nothing shows until you both submit."
        }
        back={{ href: `/dates/${id}`, label: ctx.dateTitle || "Back to the date" }}
      />
      {waiting ? <ReviewWaiting ctx={ctx} /> : <ReviewForm ctx={ctx} />}
    </div>
  );
}
