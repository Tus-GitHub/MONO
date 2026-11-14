ALTER TABLE "dates" ADD COLUMN "clientDraftKey" TEXT;
CREATE UNIQUE INDEX "dates_createdById_clientDraftKey_key" ON "dates"("createdById", "clientDraftKey");
