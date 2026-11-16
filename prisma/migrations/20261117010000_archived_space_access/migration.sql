CREATE TYPE "ArchiveAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REVOKED');
CREATE TABLE "archive_access_requests" (
  "id" TEXT NOT NULL,
  "coupleId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "status" "ArchiveAccessStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "decisions" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "archive_access_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "archive_access_requests_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "archive_access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "archive_access_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "archive_access_requests_coupleId_requesterId_key" ON "archive_access_requests"("coupleId", "requesterId");
CREATE INDEX "archive_access_requests_status_requestedAt_idx" ON "archive_access_requests"("status", "requestedAt");
CREATE INDEX "archive_access_requests_requesterId_idx" ON "archive_access_requests"("requesterId");
