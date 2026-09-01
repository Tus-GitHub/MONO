import { env } from "@/config/env";
import type { PutObjectInput, StorageDriver, StoredObject } from "@/lib/storage/types";

/**
 * Placeholder S3/R2 driver. The interface is here so production can flip `STORAGE_DRIVER=s3`;
 * the implementation lands with a real bucket + `@aws-sdk/client-s3` (not installed yet).
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";

  private unavailable(): never {
    throw new Error(
      "The S3 storage driver is not implemented yet. Set STORAGE_DRIVER=local for now.",
    );
  }

  async put(_input: PutObjectInput): Promise<StoredObject> {
    this.unavailable();
  }

  async get(_key: string): Promise<Buffer> {
    this.unavailable();
  }

  async delete(_key: string): Promise<void> {
    this.unavailable();
  }

  async exists(_key: string): Promise<boolean> {
    this.unavailable();
  }

  publicUrl(key: string): string {
    const prefix = env.STORAGE_PUBLIC_PREFIX.replace(/\/$/, "");
    return `${prefix}/${key.replace(/^\//, "")}`;
  }
}
