import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import sharp from "sharp";
import { env } from "@/config/env";
import { requireCoupleContext } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { serializable } from "@/lib/db/serializable";
import { reviewsForViewer } from "@/lib/date/review-reveal";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { storage } from "@/lib/storage";
import { isCanonicalStorageKey } from "@/lib/storage/key";
import { ARCHIVE_MAX_BYTES, ARCHIVE_MAX_MEDIA_BYTES, ARCHIVE_MAX_ROWS, archivePayloadSchema, archiveSchema, type ArchivePayload, type CoupleArchive } from "@/lib/validation/archive";
import { queueStorageCleanup, STAGED_UPLOAD_MS } from "@/server/services/storage-cleanup-service";
import { requireAuthSession } from "@/server/services/session-service";

const SECRET = new TextEncoder().encode(env.AUTH_SECRET);
const AUDIENCE = "mono:archive-restore";
const IO_BUDGET_MS = 45_000;
function checkDeadline(startedAt: number) {
  if (Date.now() - startedAt > IO_BUDGET_MS) throw new ValidationError("The portable archive took too long; use an operator database/media backup for a large space.");
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

export function archiveDigest(payload: ArchivePayload): string { return hash(JSON.stringify(payload)); }

/** Validate the whole graph before any IO or writes; external IDs never become database IDs. */
export function parseArchive(input: unknown): CoupleArchive {
  const result = archiveSchema.safeParse(input);
  if (!result.success) throw new ValidationError("This is not a supported MONO archive.");
  const archive = result.data;
  const { digest, ...payload } = archive;
  if (Buffer.byteLength(JSON.stringify(archive)) > ARCHIVE_MAX_BYTES || archiveDigest(payload) !== digest) throw new ValidationError("Archive size or checksum is invalid.");
  const groups = [archive.places, archive.categories, archive.dates, archive.activities, archive.photos, archive.reviews, archive.ratings, archive.revisits, archive.expenses, archive.memories, archive.events, archive.reminders, archive.feedback];
  if (groups.reduce((total, group) => total + group.length, 0) > ARCHIVE_MAX_ROWS) throw new ValidationError("Archive has too many records.");
  const index = (values: readonly { id: string }[]) => {
    const ids = new Set(values.map((value) => value.id));
    if (ids.size !== values.length) throw new ValidationError("Archive contains duplicate identifiers.");
    return ids;
  };
  for (const group of groups) index(group);
  const members = index(archive.members), places = index(archive.places), dates = index(archive.dates), photos = index(archive.photos), categories = index(archive.categories), reviews = index(archive.reviews), media = index(archive.media);
  if (new Set(archive.members.map((member) => member.email.toLowerCase())).size !== members.size || new Set(archive.members.map((member) => member.role)).size !== members.size || !archive.members.some((member) => member.role === "OWNER") || !archive.members.some((member) => member.email === archive.exporterEmail)) throw new ValidationError("Archive member identities are invalid.");
  const ref = (ids: Set<string>, value: string | null) => { if (value !== null && !ids.has(value)) throw new ValidationError("Archive contains an invalid reference."); };
  const unique = (values: readonly string[]) => { if (new Set(values).size !== values.length) throw new ValidationError("Archive contains duplicate records."); };
  unique(archive.categories.map((item) => item.key));
  unique(archive.reviews.map((item) => `${item.dateId}:${item.authorId}`));
  unique(archive.ratings.map((item) => `${item.reviewId}:${item.categoryId}`));
  unique(archive.revisits.map((item) => item.dateId));
  unique(archive.memories.flatMap((item) => item.dateId ? [item.dateId] : []));
  unique(archive.reminders.map((item) => `${item.dateId}:${item.userId}:${item.kind}`));
  unique(archive.feedback.map((item) => `${item.targetType}:${item.targetKey}`));
  const photoDate = new Map(archive.photos.map((item) => [item.id, item.dateId]));
  ref(media, archive.couple.photoMediaId);
  for (const item of archive.places) ref(members, item.createdById);
  for (const item of archive.dates) {
    ref(members, item.createdById); ref(members, item.startedById); ref(places, item.plannedPlaceId); ref(places, item.actualPlaceId); ref(photos, item.bestPhotoId);
    if (item.bestPhotoId && photoDate.get(item.bestPhotoId) !== item.id) throw new ValidationError("A best photo belongs to another date.");
    if (item.expectedBudgetMinCents !== null && item.expectedBudgetMaxCents !== null && item.expectedBudgetMinCents > item.expectedBudgetMaxCents) throw new ValidationError("Archive budget range is invalid.");
  }
  for (const item of archive.activities) { ref(dates, item.dateId); ref(places, item.placeId); }
  const usedMedia = new Set(archive.couple.photoMediaId ? [archive.couple.photoMediaId] : []);
  for (const item of archive.photos) { ref(dates, item.dateId); ref(members, item.uploadedById); for (const value of [item.originalMediaId, item.displayMediaId, item.thumbMediaId]) { ref(media, value); if (value) usedMedia.add(value); } }
  if (usedMedia.size !== media.size) throw new ValidationError("Archive contains unreferenced media.");
  for (const item of archive.reviews) {
    ref(dates, item.dateId); ref(members, item.authorId);
    if (item.submittedAt && item.overallRating === null) throw new ValidationError("A submitted review needs a score.");
    const author = archive.members.find((member) => member.id === item.authorId)!;
    if (author.email !== archive.exporterEmail && (!item.submittedAt || archive.members.some((member) => !archive.reviews.some((review) => review.dateId === item.dateId && review.authorId === member.id && review.submittedAt)))) throw new ValidationError("Archive includes a private partner review.");
  }
  for (const item of archive.ratings) { ref(reviews, item.reviewId); ref(categories, item.categoryId); }
  for (const item of archive.revisits) { ref(dates, item.dateId); ref(members, item.decidedById); }
  for (const item of archive.expenses) {
    ref(dates, item.dateId); ref(members, item.recordedById);
    if (item.ownerShareCents !== null && item.ownerShareCents > item.amountCents) throw new ValidationError("Archive expense split is invalid.");
  }
  for (const item of archive.memories) {
    ref(dates, item.dateId); ref(members, item.authorId); ref(photos, item.coverPhotoId);
    if (item.dateId && item.coverPhotoId && photoDate.get(item.coverPhotoId) !== item.dateId) throw new ValidationError("A memory cover belongs to another date.");
  }
  for (const item of archive.events) { ref(dates, item.dateId); ref(members, item.actorId); }
  for (const item of archive.reminders) { ref(dates, item.dateId); ref(members, item.userId); if (archive.members.find((member) => member.id === item.userId)?.email !== archive.exporterEmail) throw new ValidationError("Archive contains another person's reminders."); }
  for (const item of archive.feedback) { ref(members, item.userId); if (item.targetType === "PLACE") ref(places, item.targetKey); }
  let mediaBytes = 0;
  for (const item of archive.media) {
    const bytes = Buffer.from(item.base64, "base64");
    mediaBytes += bytes.length;
    if (bytes.toString("base64") !== item.base64 || bytes.length !== item.bytes || hash(bytes) !== item.sha256 || mediaBytes > ARCHIVE_MAX_MEDIA_BYTES) throw new ValidationError("Archive media size or checksum is invalid.");
  }
  return archive;
}

/** Snapshot shared active content and only the caller's private content. Missing media fails the download. */
export async function exportCoupleArchive(): Promise<CoupleArchive> {
  const startedAt = Date.now();
  const session = await requireAuthSession();
  const context = await requireCoupleContext();
  if (session.userId !== context.user.id) throw new AuthorizationError();
  const snapshot = await prisma.$transaction(async (tx) => {
    const couple = await tx.couple.findFirstOrThrow({ where: { id: context.couple.id, deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } }, include: { members: { where: { status: "ACTIVE", user: { deletedAt: null } }, include: { user: { select: { id: true, email: true, name: true, nickname: true, pronouns: true, tokenVersion: true } } } } } });
    if (!couple.members.some((member) => member.userId === context.user.id)) throw new AuthorizationError();
    const dates = await tx.date.findMany({ where: { coupleId: couple.id, deletedAt: null }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } });
    const dateIds = dates.map((date) => date.id);
    const [places, categories, activities, photos, rawReviews, revisits, expenses, memories, events, reminders, feedback] = await Promise.all([
      tx.place.findMany({ where: { coupleId: couple.id, deletedAt: null }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.reviewCategory.findMany({ where: { coupleId: couple.id }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.dateActivity.findMany({ where: { dateId: { in: dateIds } }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.datePhoto.findMany({ where: { dateId: { in: dateIds }, deletedAt: null }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.dateReview.findMany({ where: { dateId: { in: dateIds } }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.revisitDecision.findMany({ where: { dateId: { in: dateIds } }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.expense.findMany({ where: { coupleId: couple.id, deletedAt: null, OR: [{ dateId: null }, { dateId: { in: dateIds } }] }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.memory.findMany({ where: { coupleId: couple.id, deletedAt: null, OR: [{ dateId: null }, { dateId: { in: dateIds } }] }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.dateEvent.findMany({ where: { dateId: { in: dateIds } }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.dateReminder.findMany({ where: { dateId: { in: dateIds }, userId: context.user.id }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
      tx.recommendationFeedback.findMany({ where: { coupleId: couple.id }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } }),
    ]);
    const members = couple.members.map((member) => member.userId);
    const reviews = dates.flatMap((date) => reviewsForViewer(rawReviews.filter((review) => review.dateId === date.id), context.user.id, members));
    const ratings = await tx.dateReviewRating.findMany({ where: { reviewId: { in: reviews.map((review) => review.id) } }, take: ARCHIVE_MAX_ROWS + 1, orderBy: { id: "asc" } });
    const rowCount = [dates, places, categories, activities, photos, reviews, ratings, revisits, expenses, memories, events, reminders, feedback].reduce((count, items) => count + items.length, 0);
    if (rowCount > ARCHIVE_MAX_ROWS) throw new ValidationError("This archive exceeds the portable record limit; use an operator database/media backup.");
    return { couple, dates, places, categories, activities, photos, reviews, ratings, revisits, expenses, memories, events, reminders, feedback };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
  const { couple, ...data } = snapshot;
  const keys = new Set<string>();
  if (couple.photoKey) keys.add(couple.photoKey);
  for (const photo of data.photos) for (const key of [photo.storageKey, photo.displayKey, photo.thumbKey]) if (key) keys.add(key);
  const media: ArchivePayload["media"] = [];
  const keyMap = new Map<string, string>();
  let totalBytes = 0;
  for (const key of keys) {
    checkDeadline(startedAt);
    if (!isCanonicalStorageKey(key) || !key.startsWith(`couples/${couple.id}/`)) throw new ValidationError("A media reference is invalid.");
    const bytes = await storage.get(key);
    checkDeadline(startedAt);
    totalBytes += bytes.length;
    if (bytes.length > 12 * 1024 * 1024 || totalBytes > ARCHIVE_MAX_MEDIA_BYTES) throw new ValidationError("This archive exceeds the portable media limit; use an operator database/media backup.");
    const contentType = await imageContentType(bytes);
    const mediaId = `media_${media.length}`;
    keyMap.set(key, mediaId);
    media.push({ id: mediaId, contentType, bytes: bytes.length, sha256: hash(bytes), base64: bytes.toString("base64") });
  }
  const placeIds = new Set(data.places.map((item) => item.id));
  const photoIds = new Set(data.photos.map((item) => item.id));
  const payload = json({
    format: "mono.archive.v1" as const, exportedAt: new Date().toISOString(), exporterEmail: context.user.email.toLowerCase(), sourceCoupleId: couple.id,
    members: couple.members.map((member) => ({ ...omit(member.user, "tokenVersion"), role: member.role })),
    couple: { name: couple.name, description: couple.description, anniversaryAt: couple.anniversaryAt, currency: couple.currency, timezone: couple.timezone, createdAt: couple.createdAt, photoMediaId: couple.photoKey ? keyMap.get(couple.photoKey)! : null },
    places: data.places.map((item) => omit(item, "coupleId", "deletedAt")), categories: data.categories.map((item) => omit(item, "coupleId")),
    dates: data.dates.map((item) => ({ ...omit(item, "coupleId", "deletedAt", "version", "clientDraftKey"), plannedPlaceId: item.plannedPlaceId && placeIds.has(item.plannedPlaceId) ? item.plannedPlaceId : null, actualPlaceId: item.actualPlaceId && placeIds.has(item.actualPlaceId) ? item.actualPlaceId : null, bestPhotoId: item.bestPhotoId && photoIds.has(item.bestPhotoId) ? item.bestPhotoId : null })),
    activities: data.activities.map((item) => ({ ...item, placeId: item.placeId && placeIds.has(item.placeId) ? item.placeId : null })),
    photos: data.photos.map((item) => ({ ...omit(item, "storageKey", "displayKey", "thumbKey", "blurDataUrl", "url", "contentType", "sizeBytes", "deletedAt"), originalMediaId: keyMap.get(item.storageKey)!, displayMediaId: item.displayKey ? keyMap.get(item.displayKey)! : null, thumbMediaId: item.thumbKey ? keyMap.get(item.thumbKey)! : null })),
    reviews: data.reviews, ratings: data.ratings, revisits: data.revisits,
    expenses: data.expenses.map((item) => omit(item, "coupleId", "deletedAt")), memories: data.memories.map((item) => ({ ...omit(item, "coupleId", "deletedAt"), coverPhotoId: item.coverPhotoId && photoIds.has(item.coverPhotoId) ? item.coverPhotoId : null })),
    events: data.events, reminders: data.reminders, feedback: data.feedback.filter((item) => item.targetType !== "PLACE" || placeIds.has(item.targetKey)).map((item) => omit(item, "coupleId")), media,
  }) as unknown as ArchivePayload;
  const normalized = archivePayloadSchema.parse(payload);
  const archive = parseArchive({ ...normalized, digest: archiveDigest(normalized) });
  // Slow object reads must not let a revoked membership/session complete an export.
  const fresh = await requireCoupleContext();
  const currentSession = await requireAuthSession();
  const activeMembers = await prisma.coupleMember.findMany({ where: { coupleId: couple.id, status: "ACTIVE" }, select: { userId: true } });
  const versions = await prisma.user.findMany({ where: { id: { in: couple.members.map((member) => member.userId) }, deletedAt: null }, select: { id: true, tokenVersion: true } });
  if (fresh.couple.id !== couple.id || currentSession.sessionId !== session.sessionId || activeMembers.length !== couple.members.length || activeMembers.some((member) => !couple.members.some((original) => original.userId === member.userId)) || versions.length !== couple.members.length || couple.members.some((member) => !versions.some((user) => user.id === member.userId && user.tokenVersion === member.user.tokenVersion))) throw new AuthorizationError("The account state changed; export again.");
  return archive;
}

async function imageContentType(bytes: Buffer): Promise<ArchivePayload["media"][number]["contentType"]> {
  try {
    const info = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    const type = ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", heif: "image/avif" } as const)[info.format as "jpeg" | "png" | "webp" | "gif" | "avif" | "heif"];
    if (!type || !info.width || !info.height || info.width * info.height > 40_000_000) throw new Error("Invalid image.");
    return type;
  } catch { throw new ValidationError("Archive contains unreadable or unsupported image data."); }
}

type Destination = Awaited<ReturnType<typeof destination>>;
async function restoreBlocker(couple: { id: string; photoKey: string | null; archiveRestore: unknown }, tx: Prisma.TransactionClient = prisma) {
  if (couple.archiveRestore) return "This space has already received an archive.";
  const count = await Promise.all([tx.date.count({ where: { coupleId: couple.id } }), tx.place.count({ where: { coupleId: couple.id } }), tx.expense.count({ where: { coupleId: couple.id } }), tx.memory.count({ where: { coupleId: couple.id } }), tx.recommendationFeedback.count({ where: { coupleId: couple.id } }), tx.chatMessage.count({ where: { coupleId: couple.id } }), tx.gameMatch.count({ where: { coupleId: couple.id } }), tx.coupleCall.count({ where: { coupleId: couple.id } })]);
  return count.some(Boolean) || couple.photoKey ? "Restore requires an empty space with no existing couple cover." : null;
}

export async function getArchiveRestoreSettings() {
  const { couple: contextCouple, user } = await requireCoupleContext();
  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: contextCouple.id }, select: { id: true, name: true, photoKey: true, archiveRestore: { select: { id: true } } },
  });
  return { spaceName: couple.name, userEmail: user.email, blockedReason: await restoreBlocker(couple) };
}

async function destination(archive: CoupleArchive, tx: Prisma.TransactionClient = prisma) {
  const context = await requireCoupleContext();
  const couple = await tx.couple.findFirst({ where: { id: context.couple.id, deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } }, include: { members: { where: { status: "ACTIVE", user: { deletedAt: null } }, include: { user: { select: { id: true, email: true, tokenVersion: true } } } }, archiveRestore: true } });
  if (!couple || couple.members.length !== archive.members.length || !couple.members.some((member) => member.userId === context.user.id)) throw new AuthorizationError();
  const mapping = new Map<string, string>();
  for (const member of archive.members) {
    const target = couple.members.find((entry) => entry.user.email.toLowerCase() === member.email.toLowerCase() && entry.role === member.role);
    if (!target) throw new AuthorizationError("Restore requires the same people and owner/partner roles.");
    mapping.set(member.id, target.userId);
  }
  const blockedReason = await restoreBlocker(couple, tx);
  if (blockedReason) throw new ConflictError(blockedReason);
  return { context, couple, mapping };
}

/** Each current member independently approves the exact bytes and destination; never a bearer login token. */
export async function approveArchiveRestore(input: unknown): Promise<{ approval: string; digest: string; expiresInSeconds: number }> {
  const session = await requireAuthSession();
  const archive = parseArchive(input);
  const { context, couple } = await destination(archive);
  const user = couple.members.find((member) => member.userId === context.user.id)!.user;
  if (session.userId !== user.id || session.tokenVersion !== user.tokenVersion) throw new AuthorizationError();
  const approval = await new SignJWT({ digest: archive.digest, coupleId: couple.id, tv: user.tokenVersion, sid: session.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer("mono").setAudience(AUDIENCE).setSubject(user.id).setIssuedAt().setExpirationTime("15m").sign(SECRET);
  return { approval, digest: archive.digest, expiresInSeconds: 900 };
}

async function verifyApprovals(archive: CoupleArchive, target: Destination, approvals: readonly string[], tx: Prisma.TransactionClient = prisma) {
  const approved = new Set<string>();
  for (const token of approvals) {
    try {
      const { payload } = await jwtVerify(token, SECRET, { issuer: "mono", audience: AUDIENCE, algorithms: ["HS256"] });
      const member = target.couple.members.find((item) => item.userId === payload.sub);
      if (member && typeof payload.sid === "string" && payload.coupleId === target.couple.id && payload.digest === archive.digest && payload.tv === member.user.tokenVersion) {
        const live = await tx.authSession.findFirst({ where: { id: payload.sid, userId: member.userId, tokenVersion: member.user.tokenVersion, revokedAt: null, expiresAt: { gt: new Date() }, user: { deletedAt: null, tokenVersion: member.user.tokenVersion } }, select: { id: true } });
        if (live) approved.add(member.userId);
      }
    } catch { /* A missing, expired or revoked approval is uniformly refused below. */ }
  }
  if (approved.size !== target.couple.members.length) throw new AuthorizationError("Each member must approve this exact archive for this space.");
}

/** Files are staged with durable orphan cleanup; all database records and the receipt commit together. */
export async function restoreCoupleArchive(input: unknown, approvals: readonly string[]) {
  const startedAt = Date.now();
  const session = await requireAuthSession();
  const archive = parseArchive(input);
  const target = await destination(archive);
  if (session.userId !== target.context.user.id) throw new AuthorizationError();
  await verifyApprovals(archive, target, approvals);
  if (target.context.user.email.toLowerCase() !== archive.exporterEmail.toLowerCase()) throw new AuthorizationError("The archive exporter must perform the restore.");
  const mediaMap = new Map<string, { key: string; bytes: number; contentType: string }>();
  const prefix = `couples/${target.couple.id}/restored/${randomUUID()}`;
  for (const media of archive.media) {
    checkDeadline(startedAt);
    const bytes = Buffer.from(media.base64, "base64");
    if (await imageContentType(bytes) !== media.contentType) throw new ValidationError("Archive image type does not match its bytes.");
    const ext = media.contentType === "image/jpeg" ? "jpg" : media.contentType.slice(6);
    mediaMap.set(media.id, { key: `${prefix}/${media.id}.${ext}`, bytes: bytes.length, contentType: media.contentType });
  }
  const stagedKeys = [...mediaMap.values()].map((value) => value.key);
  await queueStorageCleanup(stagedKeys, new Date(Date.now() + STAGED_UPLOAD_MS));
  for (const media of archive.media) {
    checkDeadline(startedAt);
    await storage.put({ key: mediaMap.get(media.id)!.key, body: Buffer.from(media.base64, "base64"), contentType: media.contentType });
  }
  checkDeadline(startedAt);
  const ids = new Map<string, string>();
  for (const group of [archive.places, archive.categories, archive.dates, archive.photos, archive.reviews]) for (const item of group) ids.set(item.id, randomUUID());
  const mapped = (value: string | null) => value === null ? null : ids.get(value)!;
  await serializable(async (tx) => {
    const userIds = target.couple.members.map((member) => member.userId).sort();
    for (const id of userIds) await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM couples WHERE id = ${target.couple.id} FOR UPDATE`;
    const fresh = await destination(archive, tx);
    if (fresh.couple.id !== target.couple.id) throw new AuthorizationError();
    const liveCaller = await tx.authSession.findFirst({ where: { id: session.sessionId, userId: session.userId, tokenVersion: session.tokenVersion, revokedAt: null, expiresAt: { gt: new Date() }, user: { deletedAt: null, tokenVersion: session.tokenVersion } }, select: { id: true } });
    if (!liveCaller) throw new AuthorizationError();
    await verifyApprovals(archive, fresh, approvals, tx);
    const author = (value: string) => fresh.mapping.get(value)!;
    // The target's seeded categories have no ratings because every content table is empty.
    await tx.reviewCategory.deleteMany({ where: { coupleId: fresh.couple.id } });
    await tx.archiveRestore.create({ data: { coupleId: fresh.couple.id, digest: archive.digest, restoredById: fresh.context.user.id } });
    if (archive.places.length) await tx.place.createMany({ data: archive.places.map((item) => ({ ...item, id: mapped(item.id)!, createdById: author(item.createdById), coupleId: fresh.couple.id })) });
    if (archive.categories.length) await tx.reviewCategory.createMany({ data: archive.categories.map((item) => ({ ...item, id: mapped(item.id)!, coupleId: fresh.couple.id })) });
    if (archive.dates.length) await tx.date.createMany({ data: archive.dates.map((item) => ({ ...item, id: mapped(item.id)!, createdById: author(item.createdById), startedById: item.startedById ? author(item.startedById) : null, plannedPlaceId: mapped(item.plannedPlaceId), actualPlaceId: mapped(item.actualPlaceId), bestPhotoId: null, coupleId: fresh.couple.id })) });
    if (archive.activities.length) await tx.dateActivity.createMany({ data: archive.activities.map((item) => ({ ...item, id: randomUUID(), dateId: mapped(item.dateId)!, placeId: mapped(item.placeId) })) });
    if (archive.photos.length) await tx.datePhoto.createMany({ data: archive.photos.map((item) => {
      const original = mediaMap.get(item.originalMediaId)!;
      return { ...omit(item, "originalMediaId", "displayMediaId", "thumbMediaId"), id: mapped(item.id)!, dateId: mapped(item.dateId)!, uploadedById: author(item.uploadedById), storageKey: original.key, displayKey: item.displayMediaId ? mediaMap.get(item.displayMediaId)!.key : null, thumbKey: item.thumbMediaId ? mediaMap.get(item.thumbMediaId)!.key : null, contentType: original.contentType, sizeBytes: original.bytes, url: storage.publicUrl(original.key) };
    }) });
    if (archive.reviews.length) await tx.dateReview.createMany({ data: archive.reviews.map((item) => ({ ...item, id: mapped(item.id)!, dateId: mapped(item.dateId)!, authorId: author(item.authorId) })) });
    if (archive.ratings.length) await tx.dateReviewRating.createMany({ data: archive.ratings.map((item) => ({ ...item, id: randomUUID(), reviewId: mapped(item.reviewId)!, categoryId: mapped(item.categoryId)! })) });
    if (archive.revisits.length) await tx.revisitDecision.createMany({ data: archive.revisits.map((item) => ({ ...item, id: randomUUID(), dateId: mapped(item.dateId)!, decidedById: author(item.decidedById) })) });
    if (archive.expenses.length) await tx.expense.createMany({ data: archive.expenses.map((item) => ({ ...item, id: randomUUID(), dateId: mapped(item.dateId), recordedById: author(item.recordedById), coupleId: fresh.couple.id })) });
    if (archive.memories.length) await tx.memory.createMany({ data: archive.memories.map((item) => ({ ...item, id: randomUUID(), dateId: mapped(item.dateId), coverPhotoId: mapped(item.coverPhotoId), authorId: author(item.authorId), coupleId: fresh.couple.id })) });
    if (archive.events.length) await tx.dateEvent.createMany({ data: archive.events.map((item) => ({ ...item, id: randomUUID(), dateId: mapped(item.dateId)!, actorId: author(item.actorId), meta: item.meta === null || item.meta === undefined ? Prisma.DbNull : item.meta as Prisma.InputJsonValue })) });
    if (archive.reminders.length) await tx.dateReminder.createMany({ data: archive.reminders.map((item) => ({ ...item, id: randomUUID(), dateId: mapped(item.dateId)!, userId: author(item.userId), dismissedAt: new Date() })) });
    if (archive.feedback.length) await tx.recommendationFeedback.createMany({ data: archive.feedback.map((item) => ({ ...item, id: randomUUID(), userId: author(item.userId), targetKey: item.targetType === "PLACE" ? mapped(item.targetKey)! : item.targetKey, coupleId: fresh.couple.id })) });
    for (const date of archive.dates) if (date.bestPhotoId) await tx.date.update({ where: { id: mapped(date.id)! }, data: { bestPhotoId: mapped(date.bestPhotoId) } });
    const { photoMediaId, createdAt: _createdAt, ...coupleFields } = archive.couple;
    const photoKey = photoMediaId ? mediaMap.get(photoMediaId)!.key : null;
    await tx.couple.update({ where: { id: fresh.couple.id }, data: { ...coupleFields, photoKey, photoUrl: photoKey ? storage.publicUrl(photoKey) : null } });
    await tx.storageCleanup.deleteMany({ where: { key: { in: stagedKeys } } });
  }, { timeout: 30_000 });
  return { restored: true, digest: archive.digest, dates: archive.dates.length, photos: archive.photos.length, memories: archive.memories.length };
}
