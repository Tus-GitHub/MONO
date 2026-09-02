import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateStatus } from "@prisma/client";

import { DateDayMode } from "@/components/dates/date-day-mode";
import { DateReminderControls } from "@/components/dates/date-reminder-controls";
import { DateSpending } from "@/components/dates/date-spending";
import { DateEventList } from "@/components/dates/date-event-list";
import { PhotoGallery } from "@/components/dates/photo-gallery";
import { PlanVsReality } from "@/components/dates/plan-vs-reality";
import { DateResult } from "@/components/dates/date-result";
import { PostDateChecklist } from "@/components/dates/post-date-checklist";
import { ValueForMoneyCard } from "@/components/dates/value-for-money-card";
import { ReviewReveal } from "@/components/dates/review-reveal";
import { ReviewStatus } from "@/components/dates/review-status";
import { RevisitControl } from "@/components/dates/revisit-control";
import { StatusControl } from "@/components/dates/status-control";
import { Countdown } from "@/components/home/countdown";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { FavoriteHeart } from "@/components/memories/favorite-heart";
import { Alert } from "@/components/ui/alert";
import { DateStatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { PLACE_CATEGORY_LABEL } from "@/lib/date/place-category";
import { isAppError } from "@/lib/errors";
import { requireOnboarded } from "@/lib/onboarding";
import {
  countdownLabel,
  formatMoney,
  formatWallDate,
  relativeTime,
} from "@/lib/utils/format";
import { listDateEvents } from "@/server/services/date-event-service";
import { getDateExperience, type DateExperience } from "@/server/services/date-service";
import { getUserDateReminders } from "@/server/services/reminder-service";

export const metadata: Metadata = { title: "Date" };

export default async function DateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ planned?: string }>;
}) {
  const { user } = await requireOnboarded();
  const { id } = await params;
  const { planned } = await searchParams;

  let data: DateExperience;
  try {
    data = await getDateExperience(id, user.id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  const events = await listDateEvents(id).catch(() => []);
  const myReminders = await getUserDateReminders(id, user.id).catch(() => []);
  const customReminderIso =
    myReminders.find((r) => r.kind === "CUSTOM" && !r.sent && !r.dismissed)?.scheduledForIso ??
    null;
  const lastEdit = events[0];
  const { date, plan, actual, comparison, pipeline, photos, review, revisit, memory } = data;

  const status = date.status;
  const isDayMode = status === DateStatus.TODAY || status === DateStatus.IN_PROGRESS;
  const isDone = status === DateStatus.COMPLETED;
  const canEditPlan = (
    [DateStatus.DRAFT, DateStatus.PLANNED, DateStatus.TODAY] as DateStatus[]
  ).includes(status);
  const showActualsArea = status === DateStatus.IN_PROGRESS || isDone;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={date.title || "Untitled date"}
        back={{ href: "/dates", label: "Our dates" }}
        action={
          <div className="flex items-center gap-2">
            {canEditPlan ? (
              <LinkButton href={`/plan/${date.id}`} variant="secondary" size="sm">
                Edit plan
              </LinkButton>
            ) : null}
            <DateStatusBadge status={status} />
          </div>
        }
      />

      {planned === "1" ? (
        <Alert tone="success" title="It's a plan." className="anim-scale-in">
          Now make it a memory.
        </Alert>
      ) : null}

      {date.notes ? (
        <p className="text-sm leading-relaxed text-muted">{date.notes}</p>
      ) : null}

      {/* --- The permanent result (finished + both reviews revealed) ------- */}
      {isDone && review.revealed ? <DateResult data={data} /> : null}

      {/* --- Day of the date ------------------------------------------------ */}
      {isDayMode ? (
        <DateDayMode
          dateId={date.id}
          status={status}
          startedByLabel={
            date.startedBy ? (date.startedBy.isMe ? "you" : date.startedBy.name) : null
          }
          startedAtIso={date.startedAt}
          plannedStartIso={plan.startIso}
          activities={plan.activities}
          place={plan.place}
          currency={date.currency}
          partnerName={data.spending.contributions.partnerName}
        />
      ) : null}

      {/* --- Cancelled --------------------------------------------------------- */}
      {status === DateStatus.CANCELLED ? (
        <Alert tone="warning" title="This date was cancelled.">
          {date.cancelReason ? date.cancelReason : "It stays in your history."}
        </Alert>
      ) : null}

      {/* --- Status row ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wide text-faint">
            {isDayMode ? "More" : "Status"}
          </p>
          {lastEdit ? (
            <p className="mt-0.5 text-xs text-muted">
              {lastEdit.actor.id === user.id ? "You" : lastEdit.actor.name} {lastEdit.summary} ·{" "}
              {relativeTime(lastEdit.createdAt)}
            </p>
          ) : status === DateStatus.PLANNED && date.scheduledForYmd ? (
            <p className="mt-0.5 text-xs text-muted">
              {formatWallDate(date.scheduledForYmd, "long")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {status === DateStatus.PLANNED && plan.startIso ? (
            <Countdown
              target={plan.startIso}
              initialLabel={countdownLabel(plan.startIso)}
            />
          ) : null}
          <StatusControl dateId={date.id} status={status} />
        </div>
      </div>

      {status === DateStatus.PLANNED || status === DateStatus.TODAY ? (
        <DateReminderControls
          dateId={date.id}
          customReminderIso={customReminderIso}
          timeZone={date.timezone}
        />
      ) : null}

      {/* --- The plan ------------------------------------------------------- */}
      {isDone || isDayMode ? (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm font-medium text-ink">
            The original plan
            <Icon
              name="chevronDown"
              size="sm"
              className="text-faint transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-line p-5 pt-4">
            <PlanBody plan={plan} currency={date.currency} />
          </div>
        </details>
      ) : status !== DateStatus.CANCELLED ? (
        <Card>
          <CardHeader icon={<Icon name="calendarPlus" size="sm" />} title="The plan" />
          <PlanBody plan={plan} currency={date.currency} />
        </Card>
      ) : null}

      {/* --- Plan vs reality --------------------------------------------------- */}
      {comparison ? (
        <PlanVsReality comparison={comparison} currency={date.currency} />
      ) : showActualsArea ? (
        <Card>
          <CardHeader
            icon={<Icon name="calendarCheck" size="sm" />}
            title="How did it actually go?"
            description="Record the real place, times, spend and the things you actually did — it's allowed to look nothing like the plan."
          />
          <LinkButton href={`/dates/${date.id}/recap`} size="sm">
            Record what happened
          </LinkButton>
        </Card>
      ) : null}

      {actual.notes && comparison ? (
        <Card>
          <CardHeader icon={<Icon name="pencil" size="sm" />} title="In your words" />
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{actual.notes}</p>
          <div className="mt-3">
            <LinkButton href={`/dates/${date.id}/recap`} variant="ghost" size="sm">
              Edit the recap
            </LinkButton>
          </div>
        </Card>
      ) : null}

      {/* --- Post-date pipeline --------------------------------------------- */}
      {isDone ? <PostDateChecklist pipeline={pipeline} /> : null}

      {/* --- Photos + spending -------------------------------------------------- */}
      {showActualsArea ? (
        <>
          <PhotoGallery dateId={date.id} photos={photos} />
          <DateSpending
            dateId={date.id}
            spending={data.spending}
            expenses={data.expenses}
            partnerName={data.spending.contributions.partnerName}
          />
        </>
      ) : null}

      {/* --- Reviews (blind until both submit) ------------------------------ */}
      {showActualsArea ? (
        review.revealed && review.mine && review.partner && review.comparison ? (
          <ReviewReveal
            dateId={date.id}
            partnerLabel={review.partner.authorName}
            you={{
              name: review.mine.authorName,
              avatar: review.mine.authorAvatar,
              overall: review.mine.overallRating,
              revisit: review.mine.personalRevisit,
              revisitNote: review.mine.personalRevisitNote,
              reflections: review.mine.reflections,
            }}
            partner={{
              name: review.partner.authorName,
              avatar: review.partner.authorAvatar,
              overall: review.partner.overallRating,
              revisit: review.partner.personalRevisit,
              revisitNote: review.partner.personalRevisitNote,
              reflections: review.partner.reflections,
            }}
            comparison={review.comparison}
            revisitCompat={review.revisitCompat}
          />
        ) : (
          <ReviewStatus dateId={date.id} review={review} />
        )
      ) : null}

      {/* --- Value for money (spend ↔ the review's Value score) ----------- */}
      {data.valueForMoney ? (
        <ValueForMoneyCard vfm={data.valueForMoney} currency={date.currency} />
      ) : null}

      {/* --- Would you go again? -------------------------------------------- */}
      {showActualsArea ? (
        <section id="again" className="scroll-mt-20">
          <Card>
            <CardHeader
              icon={<Icon name="refresh" size="sm" />}
              title="Would you do this again?"
              description="One shared call. Change it whenever you like."
            />
            <RevisitControl dateId={date.id} revisit={revisit} />
          </Card>
        </section>
      ) : null}

      {/* --- Memory -------------------------------------------------------------- */}
      {showActualsArea ? (
        <section id="memory" className="scroll-mt-20">
        <Card>
          <CardHeader
            icon={<Icon name="images" size="sm" />}
            title={memory ? memory.title || "Your memory" : "Keep it as a memory"}
            action={
              <div className="flex items-center gap-1.5">
                {memory ? (
                  <FavoriteHeart
                    kind="memory"
                    id={memory.id}
                    isFavorite={memory.isFavorite}
                    className="size-8"
                  />
                ) : null}
                <LinkButton
                  href={`/dates/${date.id}/memory`}
                  variant="secondary"
                  size="sm"
                >
                  {memory ? "Edit" : "Write it"}
                </LinkButton>
              </div>
            }
          />
          {memory ? (
            <>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{memory.body}</p>
              <div className="mt-3">
                <LinkButton
                  href={`/memories/${memory.id}`}
                  variant="ghost"
                  size="sm"
                >
                  Open in Memories
                </LinkButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Turn this date into a short story you&apos;ll both want to reread.
            </p>
          )}
        </Card>
        </section>
      ) : null}

      <DateEventList events={events} currentUserId={user.id} />
    </PageContainer>
  );
}

function PlanBody({
  plan,
  currency,
}: {
  plan: DateExperience["plan"];
  currency: string;
}) {
  return (
    <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Place">
          {plan.place
            ? `${plan.place.name}${plan.place.city ? `, ${plan.place.city}` : ""} · ${PLACE_CATEGORY_LABEL[plan.place.category]}`
            : "—"}
        </Row>
        <Row label="Date">{plan.dateYmd ? formatWallDate(plan.dateYmd) : "—"}</Row>
        <Row label="Time">{plan.timeLabel ?? "—"}</Row>
        <Row label="Expected budget">{formatMoney(plan.budgetCents, currency)}</Row>
      </dl>
      {plan.activities.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {plan.activities.map((activity) => (
            <li
              key={activity.id}
              className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-muted"
            >
              {activity.title}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
