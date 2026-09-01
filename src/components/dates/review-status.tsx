import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import type { DateExperience } from "@/server/services/date-service";

/** The date-detail block for a review that hasn't revealed yet. Never shows partner scores. */
export function ReviewStatus({
  dateId,
  review,
}: {
  dateId: string;
  review: DateExperience["review"];
}) {
  const href = `/dates/${dateId}/review`;
  const partner = review.partnerName ?? "your partner";

  if (!review.mineStarted) {
    return (
      <Card>
        <CardHeader
          icon={<Icon name="star" size="sm" />}
          title="How did this date feel to you?"
          description={
            review.hasPartner
              ? `Score it your way — private until ${partner} submits their side too.`
              : "Score it your way."
          }
        />
        <LinkButton href={href} size="sm">
          Write your review
        </LinkButton>
      </Card>
    );
  }

  if (!review.mineSubmitted) {
    return (
      <Card>
        <CardHeader
          icon={<Icon name="pencil" size="sm" />}
          title="Your review is a draft"
          description="Saved and private. Submit it when it feels right — you can keep editing until then."
        />
        <LinkButton href={href} size="sm">
          Finish your review
        </LinkButton>
      </Card>
    );
  }

  // mine submitted, not yet revealed → waiting on the partner
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-success-tint text-success">
          <Icon name="check" size="sm" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-base font-medium text-ink">Your side is saved</h3>
          <p className="mt-0.5 text-sm text-muted">
            We&apos;re waiting for {partner}&apos;s side of the story. Both reviews unlock together.
          </p>
          {review.editable ? (
            <div className="mt-3">
              <LinkButton href={href} variant="secondary" size="sm">
                Edit my side
              </LinkButton>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
