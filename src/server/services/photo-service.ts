import "server-only";

import { DateStatus, Prisma } from "@prisma/client";

import { authorizeDate, authorizePhoto, requireCoupleContext } from "@/lib/authz";
import type { CoverImage, PhotoView, WallPhoto } from "@/lib/date/photo-view";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { ProcessedImage } from "@/lib/images";
import {
  buildDatePhotoBaseKey,
  datePhotoVariantKey,
  storage,
  type PhotoVariant,
} from "@/lib/storage";
import { logDateEvent } from "@/server/services/date-event-service";

const PHOTOGRAPHABLE_STATUSES: DateStatus[] = [
  DateStatus.TODAY,
  DateStatus.IN_PROGRESS,
  DateStatus.COMPLETED,
];

/** Fields needed to render a photo or resolve a cover. */
export const PHOTO_SELECT = {
  id: true,
  storageKey: true,
  displayKey: true,
  thumbKey: true,
  blurDataUrl: true,
  width: true,
  height: true,
  caption: true,
  sortOrder: true,
  isFavorite: true,
} satisfies Prisma.DatePhotoSelect;

type PhotoRow = Prisma.DatePhotoGetPayload<{ select: typeof PHOTO_SELECT }>;

function url(key: string | null | undefined, fallback: string): string {
  return key ? storage.publicUrl(key) : storage.publicUrl(fallback);
}

export function toPhotoView(row: PhotoRow, bestPhotoId: string | null): PhotoView {
  return {
    id: row.id,
    thumbUrl: url(row.thumbKey, row.storageKey),
    displayUrl: url(row.displayKey, row.storageKey),
    fullUrl: storage.publicUrl(row.storageKey),
    blurDataUrl: row.blurDataUrl,
    width: row.width,
    height: row.height,
    caption: row.caption,
    isBest: row.id === bestPhotoId,
    isFavorite: row.isFavorite,
  };
}

function toCover(row: PhotoRow): CoverImage {
  return {
    thumbUrl: url(row.thumbKey, row.storageKey),
    displayUrl: url(row.displayKey, row.storageKey),
    fullUrl: storage.publicUrl(row.storageKey),
    blurDataUrl: row.blurDataUrl,
    width: row.width,
    height: row.height,
  };
}

/**
 * The one image that stands in for a date everywhere: an explicit "best couple photo" wins,
 * then the memory's cover, then simply the first photo. Callers pass whichever they loaded.
 */
export function resolveDateCover(input: {
  bestPhoto?: PhotoRow | null;
  memoryCoverPhoto?: PhotoRow | null;
  firstPhoto?: PhotoRow | null;
}): CoverImage | null {
  const pick = input.bestPhoto ?? input.memoryCoverPhoto ?? input.firstPhoto ?? null;
  return pick ? toCover(pick) : null;
}

// ---------------------------------------------------------------------------

/**
 * Cheap pre-check for the upload routes — is the caller a member of the couple that owns this
 * date, and is the date at a stage where photos belong? Runs BEFORE the expensive image
 * pipeline so a foreign / bogus id can't burn server CPU. `addDatePhoto` re-checks anyway.
 */
export async function assertDatePhotoUploadable(dateId: string): Promise<void> {
  const { resource } = await authorizeDate(dateId);
  if (!PHOTOGRAPHABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Photos can be added once the date is under way.");
  }
}

/** Same idea for "replace this photo's image": authorize the photo before processing bytes. */
export async function assertPhotoReplaceable(photoId: string): Promise<void> {
  await authorizePhoto(photoId);
}

export async function listDatePhotos(dateId: string): Promise<PhotoView[]> {
  const { resource } = await authorizeDate(dateId);
  const [rows, date] = await Promise.all([
    prisma.datePhoto.findMany({
      where: { dateId: resource.id, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: PHOTO_SELECT,
    }),
    prisma.date.findUniqueOrThrow({
      where: { id: resource.id },
      select: { bestPhotoId: true },
    }),
  ]);
  return rows.map((row) => toPhotoView(row, date.bestPhotoId));
}

async function storeVariants(
  baseKey: string,
  processed: ProcessedImage,
): Promise<Record<PhotoVariant, string>> {
  const keys: Record<PhotoVariant, string> = {
    original: datePhotoVariantKey(baseKey, "original", processed.ext),
    display: datePhotoVariantKey(baseKey, "display", processed.ext),
    thumb: datePhotoVariantKey(baseKey, "thumb", processed.ext),
  };
  await Promise.all([
    storage.put({
      key: keys.original,
      body: processed.original.buffer,
      contentType: processed.original.contentType,
    }),
    storage.put({
      key: keys.display,
      body: processed.display.buffer,
      contentType: processed.display.contentType,
    }),
    storage.put({
      key: keys.thumb,
      body: processed.thumb.buffer,
      contentType: processed.thumb.contentType,
    }),
  ]);
  return keys;
}

async function removeKeys(keys: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    keys.filter((k): k is string => Boolean(k)).map((k) => storage.delete(k).catch(() => undefined)),
  );
}

/** Store a processed upload against a date and record the row. */
export async function addDatePhoto(
  dateId: string,
  processed: ProcessedImage,
  filename: string,
): Promise<PhotoView> {
  const { context, resource } = await authorizeDate(dateId);
  if (!PHOTOGRAPHABLE_STATUSES.includes(resource.status)) {
    throw new ValidationError("Photos can be added once the date is under way.");
  }

  const baseKey = buildDatePhotoBaseKey(context.couple.id, resource.id, filename);
  const keys = await storeVariants(baseKey, processed);

  const [max, date] = await Promise.all([
    prisma.datePhoto.aggregate({
      where: { dateId: resource.id },
      _max: { sortOrder: true },
    }),
    prisma.date.findUniqueOrThrow({ where: { id: resource.id }, select: { bestPhotoId: true } }),
  ]);

  const row = await prisma.datePhoto.create({
    data: {
      dateId: resource.id,
      uploadedById: context.user.id,
      storageKey: keys.original,
      displayKey: keys.display,
      thumbKey: keys.thumb,
      blurDataUrl: processed.blurDataUrl || null,
      url: storage.publicUrl(keys.original),
      width: processed.width || null,
      height: processed.height || null,
      sizeBytes: processed.original.bytes,
      contentType: processed.original.contentType,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: PHOTO_SELECT,
  });

  await logDateEvent(resource.id, context.user.id, "PHOTO_ADDED", "added a photo");
  return toPhotoView(row, date.bestPhotoId);
}

/** Swap the image behind an existing photo, keeping its id, caption, order and any cover roles. */
export async function replaceDatePhoto(
  photoId: string,
  processed: ProcessedImage,
  filename: string,
): Promise<PhotoView> {
  const { context, resource } = await authorizePhoto(photoId);
  const old = {
    storageKey: resource.storageKey,
    displayKey: resource.displayKey,
    thumbKey: resource.thumbKey,
  };

  const baseKey = buildDatePhotoBaseKey(context.couple.id, resource.date.id, filename);
  const keys = await storeVariants(baseKey, processed);

  const [row, date] = await Promise.all([
    prisma.datePhoto.update({
      where: { id: resource.id },
      data: {
        storageKey: keys.original,
        displayKey: keys.display,
        thumbKey: keys.thumb,
        blurDataUrl: processed.blurDataUrl || null,
        url: storage.publicUrl(keys.original),
        width: processed.width || null,
        height: processed.height || null,
        sizeBytes: processed.original.bytes,
        contentType: processed.original.contentType,
      },
      select: PHOTO_SELECT,
    }),
    prisma.date.findUniqueOrThrow({
      where: { id: resource.date.id },
      select: { bestPhotoId: true },
    }),
  ]);

  await removeKeys([old.storageKey, old.displayKey, old.thumbKey]);
  await logDateEvent(resource.date.id, context.user.id, "PHOTO_ADDED", "replaced a photo");
  return toPhotoView(row, date.bestPhotoId);
}

export async function setPhotoCaption(photoId: string, caption: string | undefined) {
  const { resource } = await authorizePhoto(photoId);
  await prisma.datePhoto.update({
    where: { id: resource.id },
    data: { caption: caption ?? null },
  });
}

export async function deleteDatePhoto(photoId: string) {
  const { resource } = await authorizePhoto(photoId);
  await prisma.$transaction([
    prisma.memory.updateMany({
      where: { coverPhotoId: resource.id },
      data: { coverPhotoId: null },
    }),
    prisma.date.updateMany({
      where: { bestPhotoId: resource.id },
      data: { bestPhotoId: null },
    }),
    prisma.datePhoto.update({
      where: { id: resource.id },
      data: { deletedAt: new Date() },
    }),
  ]);
  await removeKeys([resource.storageKey, resource.displayKey, resource.thumbKey]);
}

/** Part 4 — set (or clear, with `null`) the couple's one "most like us" photo for a date. */
export async function setBestCouplePhoto(dateId: string, photoId: string | null) {
  const { context, resource } = await authorizeDate(dateId);

  if (photoId) {
    const photo = await prisma.datePhoto.findFirst({
      where: { id: photoId, dateId: resource.id, deletedAt: null },
      select: { id: true },
    });
    if (!photo) throw new NotFoundError("That photo isn't on this date.");
  }

  await prisma.date.update({
    where: { id: resource.id },
    data: { bestPhotoId: photoId },
  });
  await logDateEvent(
    resource.id,
    context.user.id,
    "BEST_PHOTO_SET",
    photoId ? "picked the photo that feels most like you" : "cleared the best photo",
  );
}

/** Heart / un-heart a photo for the couple photo wall. Returns the new state. */
export async function togglePhotoFavorite(photoId: string): Promise<boolean> {
  const { resource } = await authorizePhoto(photoId);
  const next = !resource.isFavorite;
  await prisma.datePhoto.update({ where: { id: resource.id }, data: { isFavorite: next } });
  return next;
}

// --- Cross-date collections (the Memories photo wall + Our Favorites) ------

const WALL_DATE_SELECT = {
  id: true,
  title: true,
  scheduledFor: true,
  actualStartAt: true,
  bestPhotoId: true,
  actualPlace: { select: { name: true, city: true } },
  plannedPlace: { select: { name: true, city: true } },
} satisfies Prisma.DateSelect;

type WallDateRow = Prisma.DateGetPayload<{ select: typeof WALL_DATE_SELECT }>;

function wallDateContext(date: WallDateRow) {
  const place = date.actualPlace ?? date.plannedPlace;
  return {
    dateId: date.id,
    dateTitle: date.title || "Untitled date",
    dateYmd: (date.actualStartAt ?? date.scheduledFor)?.toISOString().slice(0, 10) ?? null,
    placeLabel: place ? `${place.name}${place.city ? `, ${place.city}` : ""}` : null,
  };
}

/** Every date's chosen "best couple photo", newest first. */
export async function getBestPhotoWall(): Promise<WallPhoto[]> {
  const { couple } = await requireCoupleContext();
  const dates = await prisma.date.findMany({
    where: {
      coupleId: couple.id,
      deletedAt: null,
      status: DateStatus.COMPLETED,
      bestPhotoId: { not: null },
    },
    orderBy: [{ scheduledFor: { sort: "desc", nulls: "last" } }, { completedAt: "desc" }],
    select: { ...WALL_DATE_SELECT, bestPhoto: { select: PHOTO_SELECT } },
  });

  return dates.flatMap((date) =>
    date.bestPhoto
      ? [{ ...toPhotoView(date.bestPhoto, date.bestPhotoId), ...wallDateContext(date) }]
      : [],
  );
}

export const PHOTO_WALL_PAGE_SIZE = 48;

export interface PhotoWallPage {
  photos: WallPhoto[];
  nextCursor: string | null;
}

/**
 * Cursor-paginated best-photo wall for the dedicated page — ordered by `completedAt` (always
 * set on a completed date) so the cursor is a single, stable field. The cursor is the last
 * item's `completedAt` ISO string.
 */
export async function getBestPhotoWallPage(
  cursor?: string,
  take = PHOTO_WALL_PAGE_SIZE,
): Promise<PhotoWallPage> {
  const { couple } = await requireCoupleContext();
  const before = cursor ? new Date(cursor) : null;

  const rows = await prisma.date.findMany({
    where: {
      coupleId: couple.id,
      deletedAt: null,
      status: DateStatus.COMPLETED,
      bestPhotoId: { not: null },
      ...(before && !Number.isNaN(before.getTime())
        ? { completedAt: { lt: before } }
        : {}),
    },
    orderBy: { completedAt: "desc" },
    take: take + 1,
    select: { ...WALL_DATE_SELECT, completedAt: true, bestPhoto: { select: PHOTO_SELECT } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];

  return {
    photos: page.flatMap((date) =>
      date.bestPhoto
        ? [{ ...toPhotoView(date.bestPhoto, date.bestPhotoId), ...wallDateContext(date) }]
        : [],
    ),
    nextCursor: hasMore && last?.completedAt ? last.completedAt.toISOString() : null,
  };
}

/** All hearted photos across every date, newest date first. */
export async function listFavoritePhotos(): Promise<WallPhoto[]> {
  const { couple } = await requireCoupleContext();
  const rows = await prisma.datePhoto.findMany({
    where: {
      deletedAt: null,
      isFavorite: true,
      date: { coupleId: couple.id, deletedAt: null },
    },
    orderBy: [{ date: { scheduledFor: "desc" } }, { sortOrder: "asc" }],
    select: { ...PHOTO_SELECT, date: { select: WALL_DATE_SELECT } },
  });

  return rows.map((row) => ({
    ...toPhotoView(row, row.date.bestPhotoId),
    ...wallDateContext(row.date),
  }));
}
