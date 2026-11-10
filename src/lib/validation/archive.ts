import { z } from "zod";
import { DateActivityKind, DateEventKind, DateStatus, ExpenseCategory, ExpensePayer, PlaceCategory, RecommendationSignal, RecommendationTargetType, ReminderKind, ReviewRevisit, RevisitChoice } from "@prisma/client";

import { ARCHIVE_MAX_ROWS } from "@/lib/archive/limits";
export { ARCHIVE_MAX_BYTES, ARCHIVE_MAX_MEDIA_BYTES, ARCHIVE_MAX_ROWS } from "@/lib/archive/limits";
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().max(30_000);
const nullableText = text.nullable();
const instant = z.string().datetime();
const optionalTime = instant.nullable();
const integer = z.number().int().min(-2147483648).max(2147483647);
const money = integer.nonnegative().nullable();
const currency = z.string().regex(/^[A-Z]{3}$/);
const stamps = { createdAt: instant, updatedAt: instant };
const common = { id, ...stamps };
const url = z.string().max(4000).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x20]/.test(value)) return true;
  try { const parsed = new URL(value); return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; }
}, "Invalid URL.").nullable();
const mediaId = id.nullable();
const row = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const rows = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).max(ARCHIVE_MAX_ROWS);

export const archivePayloadSchema = row({
  format: z.literal("mono.archive.v1"),
  exportedAt: instant,
  exporterEmail: z.string().email().max(320),
  sourceCoupleId: id,
  members: z.array(row({ id, email: z.string().email().max(320), name: text, nickname: nullableText, pronouns: nullableText, role: z.enum(["OWNER", "PARTNER"]) })).min(1).max(2),
  couple: row({ name: nullableText, description: nullableText, anniversaryAt: optionalTime, currency, timezone: z.string().max(100).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }), createdAt: instant, photoMediaId: mediaId }),
  places: rows(row({ ...common, createdById: id, name: text, category: z.nativeEnum(PlaceCategory), address: nullableText, city: nullableText, latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), mapUrl: url, website: url, phone: nullableText, notes: nullableText, description: nullableText, imageUrl: url, openingText: nullableText, isFavorite: z.boolean(), provider: nullableText, providerPlaceId: nullableText, externalRating: z.number().min(0).max(5).nullable(), externalRatingCount: integer.nonnegative().nullable(), priceLevel: integer.min(0).max(4).nullable() })),
  categories: rows(row({ ...common, key: z.string().min(1).max(128), label: text, description: nullableText, sortOrder: integer, isActive: z.boolean(), isSystem: z.boolean() })),
  dates: rows(row({ ...common, createdById: id, status: z.nativeEnum(DateStatus), title: text, notes: nullableText, scheduledFor: optionalTime, plannedStartAt: optionalTime, plannedEndAt: optionalTime, plannedPlaceId: id.nullable(), expectedBudgetCents: money, expectedBudgetMinCents: money, expectedBudgetMaxCents: money, budgetSplit: z.nativeEnum(ExpensePayer), currency, actualPlaceId: id.nullable(), actualLocationText: nullableText, actualStartAt: optionalTime, actualEndAt: optionalTime, actualSpendCents: money, actualNotes: nullableText, actualsRecordedAt: optionalTime, bestPhotoId: id.nullable(), plannedAt: optionalTime, startedAt: optionalTime, startedById: id.nullable(), completedAt: optionalTime, cancelledAt: optionalTime, cancelReason: nullableText })),
  activities: rows(row({ ...common, dateId: id, kind: z.nativeEnum(DateActivityKind), title: text, description: nullableText, placeId: id.nullable(), sortOrder: integer, startAt: optionalTime, endAt: optionalTime, durationMinutes: integer.positive().nullable(), costCents: money, completed: z.boolean(), unplanned: z.boolean() })),
  photos: rows(row({ ...common, dateId: id, uploadedById: id, originalMediaId: id, displayMediaId: mediaId, thumbMediaId: mediaId, width: integer.positive().nullable(), height: integer.positive().nullable(), caption: nullableText, takenAt: optionalTime, sortOrder: integer, isFavorite: z.boolean() })),
  reviews: rows(row({ ...common, dateId: id, authorId: id, overallRating: integer.min(1).max(10).nullable(), suggestedOverall: integer.min(1).max(10).nullable(), lovedText: nullableText, betterText: nullableText, rememberText: nullableText, unexpectedText: nullableText, personalRevisit: z.nativeEnum(ReviewRevisit).nullable(), personalRevisitNote: nullableText, submittedAt: optionalTime })),
  ratings: rows(row({ ...common, reviewId: id, categoryId: id, score: integer.min(1).max(10), note: nullableText })),
  revisits: rows(row({ ...common, dateId: id, decidedById: id, choice: z.nativeEnum(RevisitChoice), reason: nullableText, targetTimeframe: nullableText })),
  expenses: rows(row({ ...common, dateId: id.nullable(), recordedById: id, paidBy: z.nativeEnum(ExpensePayer), category: z.nativeEnum(ExpenseCategory), description: text, amountCents: integer.nonnegative(), currency, spentAt: instant, note: nullableText, ownerShareCents: money })),
  memories: rows(row({ ...common, dateId: id.nullable(), authorId: id, title: text, body: text, occurredOn: optionalTime, isFavorite: z.boolean(), coverPhotoId: id.nullable() })),
  events: rows(row({ id, dateId: id, actorId: id, kind: z.nativeEnum(DateEventKind), summary: text, meta: z.unknown(), createdAt: instant })),
  reminders: rows(row({ ...common, dateId: id, userId: id, kind: z.nativeEnum(ReminderKind), scheduledFor: instant, sentAt: optionalTime, dismissedAt: optionalTime, channel: z.string().max(100) })),
  feedback: rows(row({ ...common, userId: id, targetType: z.nativeEnum(RecommendationTargetType), targetKey: z.string().min(1).max(200), signal: z.nativeEnum(RecommendationSignal) })),
  media: z.array(row({ id, contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]), bytes: z.number().int().positive().max(12 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().max(16 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/) })).max(3000),
});

export const archiveSchema = archivePayloadSchema.extend({ digest: z.string().regex(/^[a-f0-9]{64}$/) });
export type ArchivePayload = z.infer<typeof archivePayloadSchema>;
export type CoupleArchive = z.infer<typeof archiveSchema>;
