/**
 * Shared application types. Enums come straight from Prisma so there is one source of truth.
 */
export {
  AuthProvider,
  CoupleStatus,
  CoupleMemberRole,
  CoupleMemberStatus,
  DateStatus,
  DateActivityKind,
  RevisitChoice,
  PlaceCategory,
  ExpenseCategory,
  ExpensePayer,
  NotificationType,
} from "@prisma/client";

export type {
  User,
  Account,
  Couple,
  CoupleMember,
  Place,
  Date as DateRecord,
  DateActivity,
  DatePhoto,
  ReviewCategory,
  DateReview,
  DateReviewRating,
  RevisitDecision,
  Expense,
  Memory,
  Notification,
} from "@prisma/client";

export type { ActionState, Result } from "@/lib/utils/result";
export type { SessionUser } from "@/lib/auth/current-user";
export type { CoupleContext } from "@/lib/authz/couple";
