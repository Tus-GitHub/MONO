import { sharedReviews } from "./review-reveal";

/** A newly added venue score stays blind even on an already revealed old review. */
export function sharedPlaceRatings<T extends { placeId: string; score: number }>(
  reviews: readonly { authorId: string; submittedAt: Date | string | null; placeRatings: readonly T[] }[],
  memberIds: readonly string[],
  placeId: string,
): (T & { authorId: string })[] {
  const shared = sharedReviews(reviews, memberIds);
  if (!shared.length || shared.some((review) => !review.placeRatings.some((rating) => rating.placeId === placeId))) return [];
  return shared.flatMap((review) => review.placeRatings.filter((rating) => rating.placeId === placeId).map((rating) => ({ ...rating, authorId: review.authorId })));
}
