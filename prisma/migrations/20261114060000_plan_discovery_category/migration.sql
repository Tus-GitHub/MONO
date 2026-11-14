-- A chosen filter is shared with the saved plan; legacy plans infer it from their title.
ALTER TABLE "dates" ADD COLUMN "discoveryCategory" TEXT;
