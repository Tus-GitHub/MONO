BEGIN;
ALTER TABLE "auth_sessions" ALTER COLUMN "deviceLabel" SET DEFAULT 'Browser';
ALTER TABLE "push_subscriptions" ADD COLUMN "authSessionId" TEXT;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_authSessionId_fkey" FOREIGN KEY ("authSessionId") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "push_subscriptions_authSessionId_idx" ON "push_subscriptions"("authSessionId");
COMMIT;
