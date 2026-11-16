import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { approvedArchivedPartner, requireArchivedRead } from "@/lib/authz/archived-space";
import { lockVerifiedUser } from "@/lib/authz/user-write";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { storage } from "@/lib/storage";
import { croppedUrl, readSavedCrop } from "@/lib/images/saved-crop";
import { reviewsForViewer } from "@/lib/date/review-reveal";
import { sharedPlaceRatings } from "@/lib/date/place-ratings";
import { imageSelect, messageDTO } from "./together-service";

export const archivePage = z.coerce.number().int().min(1).max(10000).catch(1);
export const archiveTab = z.enum(["dates", "memories", "photos", "chat", "expenses", "places", "games", "calls"]).catch("dates");
const pageArgs = (page: number) => ({ skip: (page - 1) * 20, take: 21 });
const photoSelect = { id: true, dateId: true, caption: true, crop: true, storageKey: true, displayKey: true, width: true, height: true } as const;
const photoDTO = (photo: { id: string; dateId: string; caption: string | null; crop: unknown; storageKey: string; displayKey: string | null; width: number | null; height: number | null }) => ({
  id: photo.id, dateId: photo.dateId, caption: photo.caption, url: croppedUrl(storage.publicUrl(photo.displayKey ?? photo.storageKey), readSavedCrop(photo.crop)),
  width: photo.width, height: photo.height,
});
const pageResult = <T>(rows: T[]) => ({ rows: rows.slice(0, 20), more: rows.length > 20 });

export async function getArchivedSpace(coupleId: string) {
  const context = await requireArchivedRead(coupleId);
  const space = await prisma.couple.findUniqueOrThrow({ where: { id: coupleId }, select: { name: true, description: true, anniversaryAt: true, photoKey: true, photoCrop: true,
    members: { select: { userId: true, user: { select: { avatarKey: true, avatarCrop: true } } } },
  } });
  return { ...context, name: space.name ?? "Your shared space", description: space.description, anniversaryAt: space.anniversaryAt,
    photoUrl: space.photoKey ? croppedUrl(storage.publicUrl(space.photoKey), readSavedCrop(space.photoCrop)) : null,
    members: space.members.map(member => ({ id: member.userId, avatarUrl: member.user.avatarKey ? croppedUrl(storage.publicUrl(member.user.avatarKey), readSavedCrop(member.user.avatarCrop)) : null })),
  };
}

export async function archivedDates(coupleId: string, page: number) {
  await requireArchivedRead(coupleId);
  return pageResult(await prisma.date.findMany({ where: { coupleId, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...pageArgs(page),
    select: { id: true, title: true, status: true, plannedStartAt: true, plannedEndAt: true, scheduledFor: true, expectedBudgetCents: true, currency: true, _count: { select: { activities: true } } } }));
}

export async function archivedDate(coupleId: string, dateId: string) {
  const context = await requireArchivedRead(coupleId);
  const date = await prisma.date.findFirst({ where: { id: dateId, coupleId, deletedAt: null }, include: {
    plannedPlace: { select: { name: true } }, actualPlace: { select: { name: true } },
    activities: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], include: { place: { select: { name: true, address: true } } } },
    reviews: { include: { ratings: { include: { category: { select: { label: true } } } }, placeRatings: { include: { place: { select: { name: true } } } } } },
    revisitDecision: true,
  } });
  if (!date) throw new NotFoundError();
  return { ...date, reviews: reviewsForViewer(date.reviews, context.userId, context.memberIds).map(review => ({ ...review,
    placeRatings: review.placeRatings.filter(rating => review.authorId === context.userId || sharedPlaceRatings(date.reviews, context.memberIds, rating.placeId).length > 0),
  })) };
}

export async function archivedMemories(coupleId: string, page: number) {
  await requireArchivedRead(coupleId);
  return pageResult(await prisma.memory.findMany({ where: { coupleId, deletedAt: null, OR: [{ dateId: null }, { date: { deletedAt: null } }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...pageArgs(page),
    select: { id: true, title: true, body: true, occurredOn: true, dateId: true, isFavorite: true } }));
}

export async function archivedPhotos(coupleId: string, page: number, dateId?: string) {
  await requireArchivedRead(coupleId);
  const rows = await prisma.datePhoto.findMany({ where: { deletedAt: null, ...(dateId ? { dateId } : {}), date: { coupleId, deletedAt: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...pageArgs(page), select: photoSelect });
  return pageResult(rows.map(photoDTO));
}

export async function archivedExpenses(coupleId: string, page: number, dateId?: string) {
  await requireArchivedRead(coupleId);
  return pageResult(await prisma.expense.findMany({ where: { coupleId, deletedAt: null, ...(dateId ? { dateId } : {}), OR: [{ dateId: null }, { date: { deletedAt: null } }] }, orderBy: [{ spentAt: "desc" }, { id: "desc" }], ...pageArgs(page),
    select: { id: true, description: true, amountCents: true, currency: true, paidBy: true, ownerShareCents: true, spentAt: true, note: true, category: true, date: { select: { title: true } } } }));
}

export async function archivedPlaces(coupleId: string, page: number) {
  await requireArchivedRead(coupleId);
  return pageResult(await prisma.place.findMany({ where: { coupleId, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...pageArgs(page),
    select: { id: true, name: true, category: true, address: true, city: true, notes: true, description: true, isFavorite: true } }));
}

export async function archivedGames(coupleId: string, page: number) {
  await requireArchivedRead(coupleId);
  return pageResult(await prisma.gameMatch.findMany({ where: { coupleId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...pageArgs(page),
    select: { id: true, kind: true, status: true, winnerId: true, createdAt: true } }));
}

export async function archivedCalls(coupleId: string, page: number) {
  await requireArchivedRead(coupleId);
  return pageResult(await prisma.coupleCall.findMany({ where: { coupleId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...pageArgs(page),
    select: { id: true, kind: true, status: true, callerId: true, createdAt: true, acceptedAt: true, endedAt: true } }));
}

export async function archivedChat(coupleId: string, rawBefore?: string | null) {
  const context = await requireArchivedRead(coupleId);
  const before = rawBefore ? z.string().regex(/^\d{1,19}$/).transform(BigInt).refine(value => value <= BigInt("9223372036854775807")).parse(rawBefore) : undefined;
  const rows = await prisma.chatMessage.findMany({ where: { coupleId, NOT: { hiddenFor: { has: context.userId } }, ...(before ? { sequence: { lt: before } } : {}) },
    orderBy: { sequence: "desc" }, take: 41, include: { image: { select: imageSelect } } });
  return { messages: rows.slice(0, 40).reverse().map(row => { const dto = messageDTO(row, context.userId); if (dto.image) dto.image.url = `/api/history-access/${coupleId}/images/${row.id}`; return dto; }),
    nextCursor: rows.length > 40 ? String(rows[39].sequence) : null };
}

/** Viewing a limited photo consumes its existing allowance; approval never resets it. */
export async function readArchivedImage(coupleId: string, id: string, consume: boolean) {
  const context = await requireArchivedRead(coupleId);
  return serializable(async tx => {
    await lockVerifiedUser(tx, context.userId);
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${coupleId} FOR UPDATE`;
    await approvedArchivedPartner(coupleId, context.userId, tx);
    const row = await tx.chatMessage.findFirst({ where: { id, coupleId, deletedAt: null, NOT: { hiddenFor: { has: context.userId } } }, include: { image: true } });
    if (!row?.image) throw new NotFoundError();
    const image = row.image;
    if (image.viewLimit > 0) {
      if (!consume) throw new ValidationError("Open this limited-view photo from the chat.");
      if (row.senderId !== context.userId) {
        if (image.viewsUsed >= image.viewLimit) throw new ValidationError("This photo has no views remaining.");
        image.viewsUsed++;
        await tx.chatImage.update({ where: { messageId: id }, data: { viewsUsed: image.viewsUsed } });
      }
    }
    return image;
  });
}

export async function readArchivedVideo(coupleId: string, messageId: string, index?: number) {
  const context = await requireArchivedRead(coupleId);
  const read = () => prisma.chatVideo.findFirst({ where: { messageId, coupleId, message: { deletedAt: null, NOT: { hiddenFor: { has: context.userId } } } }, select: { id: true, chunkCount: true, byteLength: true } });
  const row = await read();
  if (!row) throw new NotFoundError();
  if (index == null) return { chunkCount: row.chunkCount, byteLength: row.byteLength };
  if (!Number.isInteger(index) || index < 0 || index >= row.chunkCount) throw new NotFoundError();
  const part = await prisma.chatVideoPart.findUnique({ where: { videoId_index: { videoId: row.id, index } } });
  if (!part) throw new NotFoundError();
  const bytes = await storage.get(part.storageKey);
  await requireArchivedRead(coupleId);
  if (!await read()) throw new NotFoundError();
  return { iv: part.iv, data: bytes.toString("base64") };
}
