ALTER TYPE "ChatMessageKind" ADD VALUE 'DOCUMENT';
CREATE TABLE "user_audio" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ringtone" BYTEA, "contentType" TEXT, "filename" TEXT,
  "musicVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "musicEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_audio_volume" CHECK ("musicVolume" >= 0 AND "musicVolume" <= 1)
);
CREATE TABLE "site_audio" (
  "id" TEXT PRIMARY KEY, "bytes" BYTEA NOT NULL, "contentType" TEXT NOT NULL,
  "title" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
