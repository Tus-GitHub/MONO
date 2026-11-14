-- CreateEnum
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'STICKER', 'IMAGE', 'GAME');

-- CreateEnum
CREATE TYPE "MiniGameKind" AS ENUM ('TIC_TAC_TOE', 'CONNECT_FOUR', 'LUDO', 'GOMOKU', 'REVERSI', 'DOTS_BOXES', 'NIM', 'TAKE_21', 'PIG', 'ROCK_PAPER_SCISSORS', 'MEMORY', 'BATTLESHIP', 'CHESS', 'CHECKERS', 'SNAKES_LADDERS', 'MANCALA', 'SOS', 'ORDER_CHAOS', 'HEX', 'DOMINEERING', 'CHOMP', 'BREAKTHROUGH', 'PENTAGO', 'HIGHER_LOWER');

-- CreateEnum
CREATE TYPE "MiniGameStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CoupleCallKind" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CoupleCallStatus" AS ENUM ('RINGING', 'ACCEPTED', 'ENDED', 'DECLINED', 'MISSED');

-- AlterTable
ALTER TABLE "couples" ADD COLUMN     "togetherRevision" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "coupleId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "clientNonce" TEXT NOT NULL,
    "kind" "ChatMessageKind" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "gameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_images" (
    "messageId" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,

    CONSTRAINT "chat_images_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "chat_member_states" (
    "coupleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastRead" BIGINT NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typingUntil" TIMESTAMP(3),

    CONSTRAINT "chat_member_states_pkey" PRIMARY KEY ("coupleId","userId")
);

-- CreateTable
CREATE TABLE "game_matches" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "playerOneId" TEXT NOT NULL,
    "playerTwoId" TEXT NOT NULL,
    "clientNonce" TEXT NOT NULL,
    "kind" "MiniGameKind" NOT NULL,
    "status" "MiniGameStatus" NOT NULL DEFAULT 'WAITING',
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "game_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple_calls" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "clientNonce" TEXT NOT NULL,
    "kind" "CoupleCallKind" NOT NULL,
    "status" "CoupleCallStatus" NOT NULL DEFAULT 'RINGING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "callerSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calleeSeenAt" TIMESTAMP(3),

    CONSTRAINT "couple_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_signals" (
    "id" BIGSERIAL NOT NULL,
    "callId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_sequence_key" ON "chat_messages"("sequence");

-- CreateIndex
CREATE INDEX "chat_messages_coupleId_sequence_idx" ON "chat_messages"("coupleId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_senderId_clientNonce_key" ON "chat_messages"("senderId", "clientNonce");

-- CreateIndex
CREATE INDEX "chat_images_coupleId_idx" ON "chat_images"("coupleId");

-- CreateIndex
CREATE INDEX "game_matches_coupleId_updatedAt_idx" ON "game_matches"("coupleId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "game_matches_playerOneId_clientNonce_key" ON "game_matches"("playerOneId", "clientNonce");

-- CreateIndex
CREATE INDEX "couple_calls_coupleId_createdAt_idx" ON "couple_calls"("coupleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "couple_calls_callerId_clientNonce_key" ON "couple_calls"("callerId", "clientNonce");

-- CreateIndex
CREATE INDEX "call_signals_callId_id_idx" ON "call_signals"("callId", "id");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_images" ADD CONSTRAINT "chat_images_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_images" ADD CONSTRAINT "chat_images_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_member_states" ADD CONSTRAINT "chat_member_states_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_member_states" ADD CONSTRAINT "chat_member_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_calls" ADD CONSTRAINT "couple_calls_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_calls" ADD CONSTRAINT "couple_calls_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_calls" ADD CONSTRAINT "couple_calls_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_signals" ADD CONSTRAINT "call_signals_callId_fkey" FOREIGN KEY ("callId") REFERENCES "couple_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_signals" ADD CONSTRAINT "call_signals_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

