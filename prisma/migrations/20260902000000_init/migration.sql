-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('CREDENTIALS', 'GOOGLE');

-- CreateEnum
CREATE TYPE "CoupleStatus" AS ENUM ('PENDING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CoupleMemberRole" AS ENUM ('OWNER', 'PARTNER');

-- CreateEnum
CREATE TYPE "CoupleMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "DateStatus" AS ENUM ('DRAFT', 'PLANNED', 'TODAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DateActivityKind" AS ENUM ('PLANNED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "RevisitChoice" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateEnum
CREATE TYPE "ReviewRevisit" AS ENUM ('DEFINITELY', 'MAYBE', 'PROBABLY_NOT', 'NEVER_AGAIN');

-- CreateEnum
CREATE TYPE "PlaceCategory" AS ENUM ('RESTAURANT', 'CAFE', 'BAR', 'PARK', 'CINEMA', 'MUSEUM', 'ACTIVITY', 'SHOPPING', 'TRAVEL', 'HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'DRINKS', 'TRANSPORT', 'TICKETS', 'SHOPPING', 'ACCOMMODATION', 'GIFTS', 'ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpensePayer" AS ENUM ('SHARED', 'OWNER', 'PARTNER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DATE_REMINDER', 'DATE_PLANNED', 'DATE_STATUS_CHANGED', 'DATE_EDITED', 'DATE_NEEDS_ACTION', 'REVIEW_ADDED', 'REVIEW_REMINDER', 'MEMORY_ADDED', 'MEMORY_REMINDER', 'EXPENSE_ADDED', 'PARTNER_JOINED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DateEventKind" AS ENUM ('CREATED', 'TITLE_CHANGED', 'TIME_CHANGED', 'PLACE_CHANGED', 'NOTES_CHANGED', 'BUDGET_CHANGED', 'ACTIVITY_ADDED', 'ACTIVITY_UPDATED', 'ACTIVITY_REMOVED', 'ACTIVITY_REORDERED', 'STATUS_CHANGED', 'ACTUALS_RECORDED', 'PHOTO_ADDED', 'BEST_PHOTO_SET', 'REVIEW_WRITTEN', 'REVISIT_DECIDED', 'MEMORY_CREATED');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('UPCOMING', 'DATE_DAY', 'CUSTOM', 'REVIEW', 'MEMORY', 'UNFINISHED_PLAN');

-- CreateEnum
CREATE TYPE "RecommendationTargetType" AS ENUM ('PLACE', 'IDEA');

-- CreateEnum
CREATE TYPE "RecommendationSignal" AS ENUM ('INTERESTED', 'NOT_FOR_US', 'SAVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "pronouns" TEXT,
    "birthday" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "avatarKey" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "hideMoneyInsights" BOOLEAN NOT NULL DEFAULT false,
    "hidePartnerPreferenceGap" BOOLEAN NOT NULL DEFAULT false,
    "profileCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "tokenType" TEXT,
    "scope" TEXT,
    "expiresAt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couples" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "photoUrl" TEXT,
    "photoKey" TEXT,
    "status" "CoupleStatus" NOT NULL DEFAULT 'PENDING',
    "inviteCode" TEXT NOT NULL,
    "inviteCodeExpiresAt" TIMESTAMP(3),
    "anniversaryAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdById" TEXT NOT NULL,
    "setupCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "couples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple_invitations" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple_members" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CoupleMemberRole" NOT NULL DEFAULT 'PARTNER',
    "status" "CoupleMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3),
    "activitySeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PlaceCategory" NOT NULL DEFAULT 'OTHER',
    "address" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapUrl" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "openingText" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "providerPlaceId" TEXT,
    "externalRating" DOUBLE PRECISION,
    "externalRatingCount" INTEGER,
    "priceLevel" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dates" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "DateStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "plannedPlaceId" TEXT,
    "expectedBudgetCents" INTEGER,
    "expectedBudgetMinCents" INTEGER,
    "expectedBudgetMaxCents" INTEGER,
    "budgetSplit" "ExpensePayer" NOT NULL DEFAULT 'SHARED',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "actualPlaceId" TEXT,
    "actualLocationText" TEXT,
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "actualSpendCents" INTEGER,
    "actualNotes" TEXT,
    "actualsRecordedAt" TIMESTAMP(3),
    "bestPhotoId" TEXT,
    "plannedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_activities" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "kind" "DateActivityKind" NOT NULL DEFAULT 'PLANNED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "placeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "costCents" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "unplanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "date_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_photos" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "displayKey" TEXT,
    "thumbKey" TEXT,
    "blurDataUrl" TEXT,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "contentType" TEXT,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "date_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_categories" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_reviews" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "overallRating" INTEGER,
    "suggestedOverall" INTEGER,
    "lovedText" TEXT,
    "betterText" TEXT,
    "rememberText" TEXT,
    "unexpectedText" TEXT,
    "personalRevisit" "ReviewRevisit",
    "personalRevisitNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "date_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_review_ratings" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "date_review_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisit_decisions" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "choice" "RevisitChoice" NOT NULL,
    "reason" TEXT,
    "targetTimeframe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revisit_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "dateId" TEXT,
    "recordedById" TEXT NOT NULL,
    "paidBy" "ExpensePayer" NOT NULL DEFAULT 'SHARED',
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "ownerShareCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "dateId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "occurredOn" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "coverPhotoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_events" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "DateEventKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "date_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_reminders" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'inapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "date_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "upcomingDate" BOOLEAN NOT NULL DEFAULT true,
    "dateDay" BOOLEAN NOT NULL DEFAULT true,
    "reviewReminder" BOOLEAN NOT NULL DEFAULT true,
    "memoryReminder" BOOLEAN NOT NULL DEFAULT true,
    "unfinishedPlan" BOOLEAN NOT NULL DEFAULT true,
    "partnerEdits" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushSubscription" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "RecommendationTargetType" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "signal" "RecommendationSignal" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "couples_inviteCode_key" ON "couples"("inviteCode");

-- CreateIndex
CREATE INDEX "couples_createdById_idx" ON "couples"("createdById");

-- CreateIndex
CREATE INDEX "couples_status_idx" ON "couples"("status");

-- CreateIndex
CREATE UNIQUE INDEX "couple_invitations_tokenHash_key" ON "couple_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "couple_invitations_coupleId_idx" ON "couple_invitations"("coupleId");

-- CreateIndex
CREATE INDEX "couple_invitations_expiresAt_idx" ON "couple_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "couple_members_userId_idx" ON "couple_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "couple_members_coupleId_userId_key" ON "couple_members"("coupleId", "userId");

-- CreateIndex
CREATE INDEX "places_coupleId_idx" ON "places"("coupleId");

-- CreateIndex
CREATE INDEX "places_coupleId_name_idx" ON "places"("coupleId", "name");

-- CreateIndex
CREATE INDEX "places_coupleId_category_idx" ON "places"("coupleId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "places_coupleId_provider_providerPlaceId_key" ON "places"("coupleId", "provider", "providerPlaceId");

-- CreateIndex
CREATE INDEX "dates_coupleId_status_idx" ON "dates"("coupleId", "status");

-- CreateIndex
CREATE INDEX "dates_coupleId_scheduledFor_idx" ON "dates"("coupleId", "scheduledFor");

-- CreateIndex
CREATE INDEX "dates_createdById_idx" ON "dates"("createdById");

-- CreateIndex
CREATE INDEX "dates_deletedAt_idx" ON "dates"("deletedAt");

-- CreateIndex
CREATE INDEX "date_activities_dateId_kind_idx" ON "date_activities"("dateId", "kind");

-- CreateIndex
CREATE INDEX "date_activities_placeId_idx" ON "date_activities"("placeId");

-- CreateIndex
CREATE INDEX "date_photos_dateId_idx" ON "date_photos"("dateId");

-- CreateIndex
CREATE INDEX "date_photos_uploadedById_idx" ON "date_photos"("uploadedById");

-- CreateIndex
CREATE INDEX "date_photos_isFavorite_idx" ON "date_photos"("isFavorite");

-- CreateIndex
CREATE INDEX "review_categories_coupleId_idx" ON "review_categories"("coupleId");

-- CreateIndex
CREATE UNIQUE INDEX "review_categories_coupleId_key_key" ON "review_categories"("coupleId", "key");

-- CreateIndex
CREATE INDEX "date_reviews_authorId_idx" ON "date_reviews"("authorId");

-- CreateIndex
CREATE INDEX "date_reviews_dateId_submittedAt_idx" ON "date_reviews"("dateId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "date_reviews_dateId_authorId_key" ON "date_reviews"("dateId", "authorId");

-- CreateIndex
CREATE INDEX "date_review_ratings_categoryId_idx" ON "date_review_ratings"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "date_review_ratings_reviewId_categoryId_key" ON "date_review_ratings"("reviewId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "revisit_decisions_dateId_key" ON "revisit_decisions"("dateId");

-- CreateIndex
CREATE INDEX "revisit_decisions_decidedById_idx" ON "revisit_decisions"("decidedById");

-- CreateIndex
CREATE INDEX "expenses_coupleId_spentAt_idx" ON "expenses"("coupleId", "spentAt");

-- CreateIndex
CREATE INDEX "expenses_dateId_idx" ON "expenses"("dateId");

-- CreateIndex
CREATE INDEX "expenses_recordedById_idx" ON "expenses"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "memories_dateId_key" ON "memories"("dateId");

-- CreateIndex
CREATE INDEX "memories_coupleId_occurredOn_idx" ON "memories"("coupleId", "occurredOn");

-- CreateIndex
CREATE INDEX "memories_authorId_idx" ON "memories"("authorId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_coupleId_idx" ON "notifications"("coupleId");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "date_events_dateId_createdAt_idx" ON "date_events"("dateId", "createdAt");

-- CreateIndex
CREATE INDEX "date_events_actorId_idx" ON "date_events"("actorId");

-- CreateIndex
CREATE INDEX "date_reminders_userId_scheduledFor_sentAt_idx" ON "date_reminders"("userId", "scheduledFor", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "date_reminders_dateId_userId_kind_key" ON "date_reminders"("dateId", "userId", "kind");

-- CreateIndex
CREATE INDEX "recommendation_feedback_coupleId_idx" ON "recommendation_feedback"("coupleId");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_coupleId_targetType_targetKey_key" ON "recommendation_feedback"("coupleId", "targetType", "targetKey");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_invitations" ADD CONSTRAINT "couple_invitations_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_invitations" ADD CONSTRAINT "couple_invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_invitations" ADD CONSTRAINT "couple_invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_members" ADD CONSTRAINT "couple_members_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_members" ADD CONSTRAINT "couple_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_plannedPlaceId_fkey" FOREIGN KEY ("plannedPlaceId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_actualPlaceId_fkey" FOREIGN KEY ("actualPlaceId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dates" ADD CONSTRAINT "dates_bestPhotoId_fkey" FOREIGN KEY ("bestPhotoId") REFERENCES "date_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_activities" ADD CONSTRAINT "date_activities_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_activities" ADD CONSTRAINT "date_activities_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_photos" ADD CONSTRAINT "date_photos_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_photos" ADD CONSTRAINT "date_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_categories" ADD CONSTRAINT "review_categories_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_reviews" ADD CONSTRAINT "date_reviews_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_reviews" ADD CONSTRAINT "date_reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_review_ratings" ADD CONSTRAINT "date_review_ratings_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "date_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_review_ratings" ADD CONSTRAINT "date_review_ratings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "review_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisit_decisions" ADD CONSTRAINT "revisit_decisions_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisit_decisions" ADD CONSTRAINT "revisit_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "date_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_events" ADD CONSTRAINT "date_events_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_events" ADD CONSTRAINT "date_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_reminders" ADD CONSTRAINT "date_reminders_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_reminders" ADD CONSTRAINT "date_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

