import "server-only";
import { authorizeDate } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { sharedPlaceRatings } from "@/lib/date/place-ratings";
import { averageScore } from "@/lib/review/scale";
import { DATE_VENUE_SELECT, foodPlaces } from "./date-venues";

export async function getDatePlaceRatings(dateId: string) {
  const { context, resource } = await authorizeDate(dateId);
  const date = await prisma.date.findUniqueOrThrow({ where: { id: resource.id }, select: {
    ...DATE_VENUE_SELECT,
    couple: { select: { members: { where: { status: "ACTIVE" }, select: { userId: true } } } },
    reviews: { select: { authorId: true, submittedAt: true, placeRatings: { select: { placeId: true, score: true } } } },
  } });
  const members = date.couple.members.map((member) => member.userId);
  const mine = date.reviews.find((review) => review.authorId === context.user.id);
  return foodPlaces(date).map((place) => {
    const shared = sharedPlaceRatings(date.reviews, members, place.id);
    return { ...place, mine: mine?.placeRatings.find((rating) => rating.placeId === place.id)?.score ?? null,
      submitted: mine?.submittedAt != null, revealed: shared.length > 0, hasPartner: members.length > 1,
      partner: shared.find((rating) => rating.authorId !== context.user.id)?.score ?? null,
      average: averageScore(shared.map((rating) => rating.score)),
    };
  });
}

export type DatePlaceRatings = Awaited<ReturnType<typeof getDatePlaceRatings>>;
