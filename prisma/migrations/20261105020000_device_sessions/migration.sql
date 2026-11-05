BEGIN;

CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL,
  "deviceLabel" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_token_version_nonnegative" CHECK ("tokenVersion" >= 0),
  CONSTRAINT "auth_sessions_expiry_after_creation" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "auth_sessions_userId_revokedAt_expiresAt_idx" ON "auth_sessions"("userId", "revokedAt", "expiresAt");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

CREATE TABLE "archive_restores" (
  "id" TEXT NOT NULL,
  "coupleId" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "restoredById" TEXT NOT NULL,
  "restoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archive_restores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "archive_restores_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "archive_restores_coupleId_key" ON "archive_restores"("coupleId");

-- Old stateless cookies intentionally require sign-in again; no transferable session is backfilled.
COMMIT;
