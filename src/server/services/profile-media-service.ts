import "server-only";

import { requireUser } from "@/lib/auth";
import { requireCoupleContext } from "@/lib/authz";
import { serializable } from "@/lib/db/serializable";
import { NotFoundError } from "@/lib/errors";
import { buildCoupleCoverKey, buildUserAvatarKey, storage } from "@/lib/storage";
import { queueStorageCleanup, STAGED_UPLOAD_MS } from "@/server/services/storage-cleanup-service";
import type { ReadImage } from "@/server/services/upload-service";

export async function saveUserAvatar(input: ReadImage | null) {
  const user = await requireUser();
  const key = input ? buildUserAvatarKey(user.id, input.filename) : null;
  if (key && input) {
    await queueStorageCleanup([key], new Date(Date.now() + STAGED_UPLOAD_MS));
    await storage.put({ key, body: input.bytes, contentType: input.contentType });
  }
  await serializable(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
    const current = await tx.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { avatarKey: true } });
    if (!current) throw new NotFoundError();
    await tx.user.update({ where: { id: user.id }, data: { avatarKey: key, avatarUrl: key ? storage.publicUrl(key) : null } });
    await queueStorageCleanup([current.avatarKey], undefined, tx);
    if (key) await tx.storageCleanup.deleteMany({ where: { key } });
  });
  return { key, url: key ? storage.publicUrl(key) : null };
}

export async function saveCoupleCover(input: ReadImage | null) {
  const { couple, user } = await requireCoupleContext();
  const key = input ? buildCoupleCoverKey(couple.id, input.filename) : null;
  if (key && input) {
    await queueStorageCleanup([key], new Date(Date.now() + STAGED_UPLOAD_MS));
    await storage.put({ key, body: input.bytes, contentType: input.contentType });
  }
  await serializable(async (tx) => {
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${couple.id} FOR UPDATE`;
    const current = await tx.couple.findFirst({
      where: { id: couple.id, deletedAt: null, status: { in: ["PENDING", "ACTIVE"] }, members: { some: { userId: user.id, status: "ACTIVE" } } },
      select: { photoKey: true },
    });
    if (!current) throw new NotFoundError();
    await tx.couple.update({ where: { id: couple.id }, data: { photoKey: key, photoUrl: key ? storage.publicUrl(key) : null } });
    await queueStorageCleanup([current.photoKey], undefined, tx);
    if (key) await tx.storageCleanup.deleteMany({ where: { key } });
  });
  return { key, url: key ? storage.publicUrl(key) : null };
}
