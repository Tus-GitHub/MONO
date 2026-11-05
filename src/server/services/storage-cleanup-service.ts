import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LEASE_MS, MAX_ATTEMPTS, retryAt } from "@/lib/jobs/retry";
import { storage } from "@/lib/storage";
import { isCanonicalStorageKey } from "@/lib/storage/key";

export const MEDIA_RETENTION_MS = 7 * 86_400_000;
export const STAGED_UPLOAD_MS = 60 * 60_000;

/** Run before uploading bytes, or within the transaction that removes the old references. */
export async function queueStorageCleanup(
  keys: readonly (string | null | undefined)[],
  notBefore = new Date(Date.now() + MEDIA_RETENTION_MS),
  db: Pick<Prisma.TransactionClient, "storageCleanup"> = prisma,
): Promise<void> {
  for (const key of new Set(keys.filter((value): value is string => Boolean(value)))) {
    if (!isCanonicalStorageKey(key)) throw new Error("Invalid media cleanup key.");
    await db.storageCleanup.upsert({
      where: { key },
      create: { key, nextAttemptAt: notBefore },
      update: { nextAttemptAt: notBefore, attempts: 0, failedAt: null, lastError: null, leaseToken: null, leaseUntil: null },
    });
  }
}

/** Shared with the media route: retained deleted objects are not readable until restored. */
export async function isActiveMediaKey(key: string): Promise<boolean> {
  if (!isCanonicalStorageKey(key)) return false;
  const [photo, avatar, cover] = await Promise.all([
    prisma.datePhoto.findFirst({
      where: {
        deletedAt: null, OR: [{ storageKey: key }, { displayKey: key }, { thumbKey: key }],
        date: { deletedAt: null, couple: { deletedAt: null } },
      }, select: { id: true },
    }),
    prisma.user.findFirst({ where: { avatarKey: key, deletedAt: null }, select: { id: true } }),
    prisma.couple.findFirst({ where: { photoKey: key, deletedAt: null }, select: { id: true } }),
  ]);
  return Boolean(photo || avatar || cover);
}

/** Idempotent deletion with an exclusive, expiring lease and visible terminal failures. */
export async function processStorageCleanup(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const report = { processed: 0, removed: 0, kept: 0, failed: 0 };
  const expired = await prisma.storageCleanup.updateMany({
    where: { failedAt: null, attempts: { gte: MAX_ATTEMPTS }, leaseUntil: { lte: now } },
    data: { failedAt: now, leaseToken: null, leaseUntil: null, lastError: "lease_expired" },
  });
  report.failed += expired.count;
  const claimable = {
    failedAt: null, attempts: { lt: MAX_ATTEMPTS }, nextAttemptAt: { lte: now },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
  };
  const jobs = await prisma.storageCleanup.findMany({
    where: claimable, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(options.limit ?? 8, 1), 50), select: { id: true },
  });
  async function clean(candidate: { id: string }) {
    const token = randomUUID();
    const claim = await prisma.storageCleanup.updateMany({
      where: { id: candidate.id, ...claimable },
      data: { attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (!claim.count) return;
    report.processed++;
    const job = await prisma.storageCleanup.findUnique({ where: { id: candidate.id } });
    if (!job || job.leaseToken !== token) return;
    const owned = { id: job.id, leaseToken: token };
    try {
      if (!isCanonicalStorageKey(job.key)) throw new Error("Invalid key.");
      if (await isActiveMediaKey(job.key)) report.kept++;
      else { await storage.delete(job.key); report.removed++; }
      await prisma.storageCleanup.deleteMany({ where: owned });
    } catch {
      await prisma.storageCleanup.updateMany({
        where: owned,
        data: {
          leaseToken: null, leaseUntil: null, nextAttemptAt: retryAt(job.attempts, now),
          failedAt: job.attempts >= MAX_ATTEMPTS ? now : null, lastError: "cleanup_failed",
        },
      });
      report.failed++;
    }
  }
  for (let index = 0;index < jobs.length;index += 4) {
    await Promise.all(jobs.slice(index, index + 4).map(clean));
  }
  return report;
}
