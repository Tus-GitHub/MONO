import type { Metadata } from "next";

import { CoupleStats } from "@/components/home/couple-stats";
import { HomeHeader } from "@/components/home/home-header";
import { PartnerActivityBanner } from "@/components/home/partner-activity-banner";
import {
  NoUpcomingState,
  PendingReviewBanner,
  SectionUnavailable,
  StoryStartsHere,
} from "@/components/home/home-states";
import { LatestMemoryCard } from "@/components/home/latest-memory-card";
import { RecommendedNext } from "@/components/home/recommended-next";
import { UpcomingDateCard } from "@/components/home/upcoming-date-card";
import { requireOnboarded } from "@/lib/onboarding";
import { getHomeData } from "@/server/services/home-service";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const { user, status } = await requireOnboarded();
  const couple = status.couple!;
  const home = await getHomeData(couple.id, user.id);

  // Brand-new couple, zero dates.
  if (home.counts.total === 0) {
    return <StoryStartsHere coupleName={home.couple.name} />;
  }

  const me = home.members.find((member) => member.id === user.id) ?? {
    name: user.name,
    avatarUrl: user.avatarUrl,
  };

  const hasUpcoming = home.upcoming.ok && home.upcoming.value != null;
  const subline =
    home.pendingReviewCount > 0
      ? "There's a date worth looking back on."
      : hasUpcoming
        ? "You've got something to look forward to."
        : "Ready for another adventure?";

  return (
    <div className="space-y-8">
      <HomeHeader
        members={home.members}
        me={me}
        couplePhotoUrl={home.couple.photoUrl}
        timezone={home.couple.timezone}
        unreadNotifications={home.unreadNotifications}
        subline={subline}
      />

      {home.partnerEdit ? <PartnerActivityBanner edit={home.partnerEdit} /> : null}

      {home.pendingReviewCount > 0 ? (
        <PendingReviewBanner count={home.pendingReviewCount} />
      ) : null}

      {!home.upcoming.ok ? (
        <SectionUnavailable label="Your next date" />
      ) : home.upcoming.value ? (
        <UpcomingDateCard date={home.upcoming.value} />
      ) : (
        <NoUpcomingState />
      )}

      {home.counts.completed > 0 ? (
        !home.latestMemory.ok ? (
          <SectionUnavailable label="Your last date" />
        ) : home.latestMemory.value ? (
          <LatestMemoryCard memory={home.latestMemory.value} />
        ) : null
      ) : null}

      {home.counts.completed > 0 || home.counts.memories > 0 ? (
        home.stats.ok ? (
          <CoupleStats stats={home.stats.value} />
        ) : (
          <SectionUnavailable label="Your stats" />
        )
      ) : null}

      {home.recommendations.ok && home.recommendations.value.length > 0 ? (
        <RecommendedNext items={home.recommendations.value} />
      ) : null}
    </div>
  );
}
