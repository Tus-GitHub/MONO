CREATE TABLE "solo_game_scores" (
  "coupleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "bestScore" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "solo_game_scores_pkey" PRIMARY KEY ("coupleId", "userId", "kind"),
  CONSTRAINT "solo_game_scores_kind_check" CHECK ("kind" IN ('EMOJI_BOUNCE', 'SNAKE', 'MERGE_2048')),
  CONSTRAINT "solo_game_scores_score_check" CHECK ("bestScore" >= 0),
  CONSTRAINT "solo_game_scores_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "solo_game_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "solo_game_scores_userId_idx" ON "solo_game_scores"("userId");
