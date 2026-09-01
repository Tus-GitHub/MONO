import "server-only";

import { DateStatus, NotificationType } from "@prisma/client";

import { authorizeDate } from "@/lib/authz";
import type { PhotoView } from "@/lib/date/photo-view";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { DateMemoryInput } from "@/lib/validation/date";
import { logDateEvent } from "@/server/services/date-event-service";
import { notifyPartner } from "@/server/services/notification-service";
import { PHOTO_SELECT, toPhotoView } from "@/server/services/photo-service";

const MEMORABLE_STATUSES: DateStatus[] = [DateStatus.IN_PROGRESS, DateStatus.COMPLETED];

export interface MemoryContext {
  dateTitle: string;
  status: DateStatus;
  memorable: boolean;
  photos: PhotoView[];
  memory: {
    id: string;
    title: string;
    body: string;
    isFavorite: boolean;
    coverPhotoId: string | null;
  } | null;
}

export async function getMemoryContext(dateId: string): Promise<MemoryContext> {
  const { resource } = await authorizeDate(dateId);
  const date = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    include: {
      photos: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: PHOTO_SELECT,
      },
      memory: { select: { id: true, title: true, body: true, isFavorite: true, coverPhotoId: true } },
    },
  });
  return {
    dateTitle: date.title,
    status: date.status,
    memorable: MEMORABLE_STATUSES.includes(date.status),
    photos: date.photos.map((row) => toPhotoView(row, date.bestPhotoId)),
    memory: date.memory,
  };
}

export async function saveMemory(dateId: string, input: DateMemoryInput) {
  const { context, resource } = await authorizeDate(dateId);
  if (!MEMORABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Keep a memory once the date has happened.");
  }

  let coverPhotoId: string | null = null;
  if (input.coverPhotoId) {
    const photo = await prisma.datePhoto.findFirst({
      where: { id: input.coverPhotoId, dateId: resource.id, deletedAt: null },
      select: { id: true },
    });
    if (!photo) throw new NotFoundError("That photo isn't on this date.");
    coverPhotoId = photo.id;
  }

  const date = await prisma.date.findUniqueOrThrow({
    where: { id: resource.id },
    select: { actualStartAt: true, scheduledFor: true, memory: { select: { id: true } } },
  });
  const isNew = !date.memory;
  const occurredOn = date.actualStartAt ?? date.scheduledFor ?? null;

  await prisma.memory.upsert({
    where: { dateId: resource.id },
    create: {
      coupleId: context.couple.id,
      dateId: resource.id,
      authorId: context.user.id,
      title: input.title,
      body: input.body,
      occurredOn,
      isFavorite: input.isFavorite,
      coverPhotoId,
    },
    update: {
      title: input.title,
      body: input.body,
      isFavorite: input.isFavorite,
      coverPhotoId,
      deletedAt: null,
    },
  });

  await logDateEvent(
    resource.id,
    context.user.id,
    "MEMORY_CREATED",
    isNew ? "kept this as a memory" : "updated the memory",
  );
  if (isNew) {
    await notifyPartner({
      coupleId: context.couple.id,
      actorId: context.user.id,
      type: NotificationType.MEMORY_ADDED,
      title: "A new memory",
      body: input.title,
      entityType: "Date",
      entityId: resource.id,
    });
  }
}

export async function deleteMemory(dateId: string) {
  const { resource } = await authorizeDate(dateId);
  const deleted = await prisma.memory.updateMany({
    where: { dateId: resource.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (deleted.count === 0) throw new NotFoundError("There's no memory to remove.");
}
