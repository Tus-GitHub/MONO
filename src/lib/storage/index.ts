import { isProduction, env } from "@/config/env";
import { randomToken } from "@/lib/utils/crypto";
import { LocalStorageDriver } from "@/lib/storage/local";
import { S3StorageDriver } from "@/lib/storage/s3";
import type { StorageDriver } from "@/lib/storage/types";

export type { StorageDriver, StoredObject, PutObjectInput } from "@/lib/storage/types";
export { IMAGE_UPLOAD, validateImageUpload } from "@/lib/storage/image-rules";

function createDriver(): StorageDriver {
  switch (env.STORAGE_DRIVER) {
    case "s3":
      return new S3StorageDriver();
    case "local":
    default:
      return new LocalStorageDriver();
  }
}

const globalForStorage = globalThis as unknown as { storage?: StorageDriver };

export const storage: StorageDriver = globalForStorage.storage ?? createDriver();

if (!isProduction) globalForStorage.storage = storage;

function safeName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = (dot > 0 ? filename.slice(0, dot) : filename)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const ext = (dot > 0 ? filename.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
  return ext ? `${base || "file"}.${ext}` : base || "file";
}

/** Slugified filename stem (no extension) — used as the shared base for a photo's variants. */
function slugStem(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return (
    stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "photo"
  );
}

/**
 * Object keys are namespaced by owner. The `/media` route parses the prefix and re-checks
 * access before streaming, so the key layout is itself part of the isolation story:
 *   users/<userId>/...            → only that user
 *   couples/<coupleId>/...        → only active members of that couple
 */
export function buildDatePhotoKey(coupleId: string, dateId: string, filename: string): string {
  return `couples/${coupleId}/dates/${dateId}/photos/${randomToken(8)}-${safeName(filename)}`;
}

/**
 * Extensionless base key for one uploaded photo. Its variants hang off this base
 * (`<base>.webp`, `<base>.display.webp`, `<base>.thumb.webp`), so they all sit under the same
 * `couples/<id>/` prefix the `/media` route authorizes against, and the random token makes any
 * of them unguessable.
 */
export function buildDatePhotoBaseKey(
  coupleId: string,
  dateId: string,
  filename: string,
): string {
  return `couples/${coupleId}/dates/${dateId}/photos/${randomToken(9)}-${slugStem(filename)}`;
}

export type PhotoVariant = "original" | "display" | "thumb";

/** Resolve one variant's storage key from a photo's base key. */
export function datePhotoVariantKey(
  baseKey: string,
  variant: PhotoVariant,
  ext: string,
): string {
  return variant === "original" ? `${baseKey}.${ext}` : `${baseKey}.${variant}.${ext}`;
}

export function buildUserAvatarKey(userId: string, filename: string): string {
  return `users/${userId}/avatar/${randomToken(8)}-${safeName(filename)}`;
}

export function buildCoupleCoverKey(coupleId: string, filename: string): string {
  return `couples/${coupleId}/cover/${randomToken(8)}-${safeName(filename)}`;
}

export function coupleIdFromKey(key: string): string | null {
  const match = /^couples\/([a-z0-9_-]+)\//i.exec(key.replace(/^\//, ""));
  return match ? match[1] : null;
}

export function userIdFromKey(key: string): string | null {
  const match = /^users\/([a-z0-9_-]+)\//i.exec(key.replace(/^\//, ""));
  return match ? match[1] : null;
}

