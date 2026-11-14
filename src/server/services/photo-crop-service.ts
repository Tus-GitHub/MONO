import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { authorizePhoto, requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { croppedUrl, cropToken, readSavedCrop, type SavedCropInfo } from "@/lib/images/saved-crop";
import { storage } from "@/lib/storage";
import { cropTargetSchema, saveCropSchema } from "@/lib/validation/photo-crop";
import { withDateWrite } from "./date-write";
import { PHOTO_SELECT, toPhotoView } from "./photo-service";
import { bumpTogether, requireTogether, withTogetherWrite } from "./together-context";
import { imageSelect, messageDTO } from "./together-service";

const revision = (identity: string, crop: unknown) => createHash("sha256").update(`${identity}:${cropToken(readSavedCrop(crop))}`).digest("base64url");
function info(sourceUrl: string, identity: string, crop: unknown): SavedCropInfo {
  return { sourceUrl, crop: readSavedCrop(crop), revision: revision(identity, crop) };
}
function unchanged(expected: string, identity: string, crop: unknown) {
  if (expected !== revision(identity, crop)) throw new ConflictError("This photo changed. Close the editor and open it again to keep the latest changes.");
}
const activeCouple = (id: string, userId: string) => ({ id, deletedAt: null, status: { in: ["PENDING", "ACTIVE"] as ("PENDING" | "ACTIVE")[] },
  members: { some: { userId, status: "ACTIVE" as const, user: { deletedAt: null } } } });

export async function getSavedPhotoCrop(value: unknown): Promise<SavedCropInfo> {
  const target = cropTargetSchema.parse(value);
  if (target.kind === "avatar") {
    const user = await requireUser();
    const current = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { avatarKey: true, avatarCrop: true } });
    if (!current?.avatarKey) throw new NotFoundError("Upload a profile photo before adjusting it.");
    return info(storage.publicUrl(current.avatarKey), current.avatarKey, current.avatarCrop);
  }
  if (target.kind === "couple") {
    const { couple, user } = await requireCoupleContext();
    const current = await prisma.couple.findFirst({ where: activeCouple(couple.id, user.id), select: { photoKey: true, photoCrop: true } });
    if (!current?.photoKey) throw new NotFoundError("Upload a couple photo before adjusting it.");
    return info(storage.publicUrl(current.photoKey), current.photoKey, current.photoCrop);
  }
  if (target.kind === "date") {
    const { resource } = await authorizePhoto(target.id!);
    return info(storage.publicUrl(resource.storageKey), resource.storageKey, resource.crop);
  }
  const { couple, user } = await requireTogether();
  const message = await prisma.chatMessage.findFirst({ where: { id: target.id, coupleId: couple.id, senderId: user.id, deletedAt: null, NOT: { hiddenFor: { has: user.id } } }, include: { image: { select: imageSelect } } });
  if (!message?.image) throw new NotFoundError();
  return info(`/api/together/images/${message.id}`, `${message.id}:${message.version}`, message.image.crop);
}

/** Only normalized crop metadata crosses the network; stored source bytes stay immutable. */
export async function savePhotoCrop(value: unknown) {
  const { target, crop, revision: expected } = saveCropSchema.parse(value);
  const data = crop ?? Prisma.DbNull;
  if (target.kind === "avatar") {
    const user = await requireUser();
    return serializable(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const current = await tx.user.findFirst({ where: { id: user.id, deletedAt: null } });
      if (!current?.avatarKey) throw new NotFoundError();
      unchanged(expected, current.avatarKey, current.avatarCrop);
      const url = croppedUrl(storage.publicUrl(current.avatarKey), crop);
      await tx.user.update({ where: { id: user.id }, data: { avatarCrop: data, avatarUrl: url } });
      await tx.couple.updateMany({ where: { deletedAt: null, status: { in: ["PENDING", "ACTIVE"] }, members: { some: { userId: user.id, status: "ACTIVE" } } }, data: { updatedAt: new Date() } });
      return { url };
    });
  }
  if (target.kind === "couple") {
    const { couple, user } = await requireCoupleContext();
    return serializable(async (tx) => {
      await tx.$queryRaw`SELECT id FROM couples WHERE id = ${couple.id} FOR UPDATE`;
      const current = await tx.couple.findFirst({ where: activeCouple(couple.id, user.id) });
      if (!current?.photoKey) throw new NotFoundError();
      unchanged(expected, current.photoKey, current.photoCrop);
      const url = croppedUrl(storage.publicUrl(current.photoKey), crop);
      await tx.couple.update({ where: { id: couple.id }, data: { photoCrop: data, photoUrl: url } });
      return { url };
    });
  }
  if (target.kind === "date") {
    const { resource } = await authorizePhoto(target.id!);
    return withDateWrite(resource.date.id, async (tx, date) => {
      const current = await tx.datePhoto.findFirst({ where: { id: resource.id, dateId: date.id, deletedAt: null } });
      if (!current) throw new NotFoundError();
      unchanged(expected, current.storageKey, current.crop);
      const row = await tx.datePhoto.update({ where: { id: current.id }, data: { crop: data, url: croppedUrl(storage.publicUrl(current.storageKey), crop) }, select: PHOTO_SELECT });
      return { photo: toPhotoView(row, date.bestPhotoId) };
    });
  }
  const context = await requireTogether();
  return withTogetherWrite(context, async (tx) => {
    const message = await tx.chatMessage.findFirst({ where: { id: target.id, coupleId: context.couple.id, senderId: context.user.id, deletedAt: null, NOT: { hiddenFor: { has: context.user.id } } }, include: { image: { select: imageSelect } } });
    if (!message?.image) throw new NotFoundError();
    unchanged(expected, `${message.id}:${message.version}`, message.image.crop);
    await tx.chatImage.update({ where: { messageId: message.id }, data: { crop: data } });
    const updated = await bumpTogether(tx, context.couple.id);
    const row = await tx.chatMessage.update({ where: { id: message.id }, data: { version: { increment: 1 }, revision: updated.togetherRevision, editedAt: new Date() }, include: { image: { select: imageSelect } } });
    return { message: messageDTO(row, context.user.id) };
  });
}
