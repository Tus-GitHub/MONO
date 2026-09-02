import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { env } from "@/config/env";
import type { PutObjectInput, StorageDriver, StoredObject } from "@/lib/storage/types";

/**
 * Local-disk storage for development. Resolved lazily so the bundler does not trace the whole
 * project for this dev-only path.
 */
function storageRoot(): string {
  const configured = env.STORAGE_LOCAL_ROOT;
  return isAbsolute(configured)
    ? configured
    : resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

/**
 * Map a storage key to an on-disk path. Rejects absolute paths, `..` escapes that leave the
 * root, and — critically — any `..` segment at all: a `..` that nets back inside the root
 * (`couples/a/../users/b`) would still cross an ownership boundary the `/media` route already
 * authorized against.
 */
function resolveKey(key: string): string {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(key)) {
    throw new Error(`Refusing a storage key with a ".." segment: ${key}`);
  }
  const root = storageRoot();
  const full = join(root, key);
  const rel = relative(root, full);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing to access a storage path outside the root: ${key}`);
  }
  return full;
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";

  async put(input: PutObjectInput): Promise<StoredObject> {
    const path = resolveKey(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
    return {
      key: input.key,
      url: this.publicUrl(input.key),
      size: input.body.byteLength,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKey(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    const prefix = env.STORAGE_PUBLIC_PREFIX.replace(/\/$/, "");
    return `${prefix}/${key.replace(/^\//, "")}`;
  }
}
