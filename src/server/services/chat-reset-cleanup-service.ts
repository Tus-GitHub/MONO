import "server-only";
import type { Prisma } from "@prisma/client";
import { processStorageCleanup } from "./storage-cleanup-service";

const videoPrefix = (coupleId: string) => `couples/${coupleId}/chat-videos/`;

/** Called under the couple lock, in the same transaction as dual approval and key rotation. */
export async function erasePreviousChat(tx: Prisma.TransactionClient, coupleId: string, generation: number, now: Date) {
  // Queue every referenced chunk before its metadata cascades away. Set-based SQL keeps
  // large video histories within the transaction budget without loading ciphertext into memory.
  await tx.$executeRaw`
    INSERT INTO storage_cleanup (id, key, "nextAttemptAt")
    SELECT gen_random_uuid()::text, p."storageKey", ${now}
    FROM chat_video_parts p JOIN chat_videos v ON v.id = p."videoId"
    LEFT JOIN chat_messages m ON m.id = v."messageId"
    WHERE v."coupleId" = ${coupleId} AND (v."messageId" IS NULL OR m.generation <= ${generation})
    ON CONFLICT (key) DO UPDATE SET "nextAttemptAt" = EXCLUDED."nextAttemptAt",
      attempts = 0, "failedAt" = NULL, "lastError" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL`;
  // Include chunks staged before reset whose object upload is still in flight.
  await tx.storageCleanup.updateMany({ where: { key: { startsWith: videoPrefix(coupleId) } },
    data: { nextAttemptAt: now, attempts: 0, failedAt: null, lastError: null, leaseToken: null, leaseUntil: null } });
  await tx.chatVideo.deleteMany({ where: { coupleId, OR: [{ messageId: null }, { message: { generation: { lte: generation } } }] } });
  // Images, documents and custom stickers use ChatImage and cascade with their messages.
  // Deleting a chat invitation does not delete its GameMatch or any score.
  await tx.chatMessage.deleteMany({ where: { coupleId, generation: { lte: generation } } });
}

/** Best-effort immediate drain; durable jobs also run through the existing retry worker. */
export async function cleanResetChatFiles(coupleId: string) {
  const deadline = Date.now() + 20_000;
  for (let batch = 0; batch < 10 && Date.now() < deadline; batch++) {
    const report = await processStorageCleanup({ keyPrefix: videoPrefix(coupleId), limit: 50 });
    if (report.processed < 50) break;
  }
}
