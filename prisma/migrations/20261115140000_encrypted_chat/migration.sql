ALTER TABLE "couples" ADD COLUMN "chatKeyId" TEXT;
ALTER TABLE "chat_messages"
  ADD COLUMN "encrypted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "hiddenFor" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "chat_messages_coupleId_revision_idx" ON "chat_messages"("coupleId", "revision");
ALTER TABLE "chat_images"
  ADD COLUMN "encrypted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "iv" TEXT,
  ADD COLUMN "viewLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "viewsUsed" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "chat_image_views_valid" CHECK ("viewLimit" IN (0,1,2) AND "viewsUsed" >= 0 AND ("viewLimit" = 0 OR "viewsUsed" <= "viewLimit"));
