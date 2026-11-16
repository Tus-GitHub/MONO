ALTER TABLE "game_matches" ADD COLUMN "rematchRequestedById" TEXT, ADD COLUMN "rematchRequestedAt" TIMESTAMP(3), ADD COLUMN "rematchGameId" TEXT;
CREATE UNIQUE INDEX "game_matches_rematchGameId_key" ON "game_matches"("rematchGameId");
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_rematchGameId_fkey" FOREIGN KEY ("rematchGameId") REFERENCES "game_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "game_chat_signals" (
 "id" BIGSERIAL PRIMARY KEY, "gameId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL, "targetSessionId" TEXT, "kind" TEXT NOT NULL, "payload" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "game_chat_signals_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "game_chat_signals_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "game_chat_signals_gameId_id_idx" ON "game_chat_signals"("gameId", "id");
CREATE INDEX "game_chat_signals_createdAt_idx" ON "game_chat_signals"("createdAt");
CREATE TABLE "audio_uploads" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "totalBytes" INTEGER NOT NULL,
 "bytes" BYTEA NOT NULL, "nextPart" INTEGER NOT NULL DEFAULT 0, "lastDigest" TEXT,
 "published" BOOLEAN NOT NULL DEFAULT false, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "audio_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "audio_uploads_userId_idx" ON "audio_uploads"("userId");
CREATE INDEX "audio_uploads_expiresAt_idx" ON "audio_uploads"("expiresAt");
