ALTER TABLE "couples" ADD COLUMN "chatGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "chat_messages" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "chat_messages_coupleId_generation_sequence_idx" ON "chat_messages"("coupleId", "generation", "sequence");
CREATE INDEX "chat_messages_coupleId_generation_revision_idx" ON "chat_messages"("coupleId", "generation", "revision");

CREATE TABLE "chat_reset_requests" (
  "coupleId" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL UNIQUE,
  "requestedById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "partnerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "generation" INTEGER NOT NULL,
  "newKeyId" TEXT NOT NULL,
  "requesterEmailHash" TEXT NOT NULL,
  "partnerEmailHash" TEXT NOT NULL,
  "requesterOtpHash" TEXT NOT NULL,
  "partnerOtpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowCount" INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK ("requestedById" <> "partnerId"),
  CHECK ("attempts" >= 0 AND "windowCount" > 0)
);
