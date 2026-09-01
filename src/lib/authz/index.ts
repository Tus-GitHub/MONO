/**
 * Authorization layer. Every couple-scoped server operation goes through here.
 * See `couple.ts` for the rule of the road.
 */
export {
  getCoupleContext,
  requireCoupleContext,
  requireCoupleMembership,
  authorizeDate,
  authorizePlace,
  authorizePhoto,
  authorizeExpense,
  authorizeMemory,
  authorizeReview,
  authorizeReviewCategory,
  type CoupleContext,
} from "@/lib/authz/couple";
export { requireCoupleOrOnboard, redirectIfHasCouple } from "@/lib/authz/guards";
