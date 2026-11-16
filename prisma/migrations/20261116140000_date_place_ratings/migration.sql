-- Additive: historical whole-date scores are deliberately not copied to venues.
CREATE TABLE "date_place_ratings" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL CHECK ("score" BETWEEN 1 AND 10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "date_place_ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "date_place_ratings_reviewId_placeId_key" ON "date_place_ratings"("reviewId", "placeId");
CREATE INDEX "date_place_ratings_placeId_idx" ON "date_place_ratings"("placeId");
ALTER TABLE "date_place_ratings" ADD CONSTRAINT "date_place_ratings_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "date_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "date_place_ratings" ADD CONSTRAINT "date_place_ratings_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;
