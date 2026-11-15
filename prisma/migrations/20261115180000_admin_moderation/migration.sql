ALTER TABLE "users" ADD COLUMN "blockedAt" TIMESTAMP(3), ADD COLUMN "moderationEmailHash" TEXT;
CREATE INDEX "users_moderationEmailHash_idx" ON "users"("moderationEmailHash");
CREATE TABLE "admin_access" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "loginAlias" TEXT UNIQUE,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "email_blocks" (
  "emailHash" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "blockedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "account_reports" (
  "id" TEXT PRIMARY KEY,
  "reporterId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'DISMISSED', 'ACTIONED')),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "account_reports_status_createdAt_id_idx" ON "account_reports"("status", "createdAt", "id");
CREATE INDEX "account_reports_reporterId_createdAt_idx" ON "account_reports"("reporterId", "createdAt");
CREATE UNIQUE INDEX "account_reports_one_open_pair" ON "account_reports"("reporterId", "targetId") WHERE "status" = 'OPEN';
CREATE TABLE "moderation_audit" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "moderation_audit_createdAt_id_idx" ON "moderation_audit"("createdAt", "id");
