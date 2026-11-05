BEGIN;
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'CANCELLED', 'FAILED');
CREATE TABLE "push_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "endpoint" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- Preserve usable existing browser subscriptions; a shared endpoint belongs to its latest owner.
INSERT INTO "push_subscriptions" ("id", "userId", "endpoint", "data", "updatedAt")
SELECT DISTINCT ON ("pushSubscription"->>'endpoint')
  'legacy_' || md5("userId" || ("pushSubscription"->>'endpoint')),
  "userId", "pushSubscription"->>'endpoint', "pushSubscription", "updatedAt"
FROM "notification_preferences"
WHERE "pushEnabled" = true
  AND jsonb_typeof("pushSubscription") = 'object'
  AND "pushSubscription"->>'endpoint' LIKE 'https://%'
  AND jsonb_typeof("pushSubscription"->'keys') = 'object'
ORDER BY "pushSubscription"->>'endpoint', "updatedAt" DESC, "userId";
UPDATE "notification_preferences" SET "pushSubscription" = NULL;

CREATE TABLE "notification_deliveries" (
  "id" TEXT PRIMARY KEY,
  "notificationId" TEXT NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "subscriptionId" TEXT REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 6),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "notification_deliveries_notificationId_subscriptionId_key"
  ON "notification_deliveries"("notificationId", "subscriptionId");
CREATE INDEX "notification_deliveries_status_nextAttemptAt_idx" ON "notification_deliveries"("status", "nextAttemptAt");
CREATE INDEX "notification_deliveries_userId_status_idx" ON "notification_deliveries"("userId", "status");

CREATE TABLE "storage_cleanup" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 6),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "storage_cleanup_key_key" ON "storage_cleanup"("key");
CREATE INDEX "storage_cleanup_failedAt_nextAttemptAt_idx" ON "storage_cleanup"("failedAt", "nextAttemptAt");
CREATE INDEX "date_reminders_pending_due" ON "date_reminders"("scheduledFor", "userId")
  WHERE "sentAt" IS NULL AND "dismissedAt" IS NULL;
COMMIT;
