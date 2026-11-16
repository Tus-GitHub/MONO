ALTER TYPE "ChatMessageKind" ADD VALUE 'VIDEO';
CREATE TABLE "chat_videos" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "coupleId" TEXT NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clientNonce" TEXT NOT NULL, "keyId" TEXT NOT NULL, "body" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL, "chunkCount" INTEGER NOT NULL,
  "messageId" TEXT REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "chat_videos_senderId_clientNonce_key" ON "chat_videos"("senderId", "clientNonce");
CREATE UNIQUE INDEX "chat_videos_messageId_key" ON "chat_videos"("messageId");
CREATE INDEX "chat_videos_coupleId_idx" ON "chat_videos"("coupleId");
CREATE INDEX "chat_videos_expiresAt_idx" ON "chat_videos"("expiresAt");
CREATE TABLE "chat_video_parts" (
  "videoId" TEXT NOT NULL REFERENCES "chat_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "index" INTEGER NOT NULL, "storageKey" TEXT NOT NULL, "byteLength" INTEGER NOT NULL,
  "iv" TEXT NOT NULL, "digest" TEXT NOT NULL,
  PRIMARY KEY ("videoId", "index")
);
CREATE UNIQUE INDEX "chat_video_parts_storageKey_key" ON "chat_video_parts"("storageKey");
