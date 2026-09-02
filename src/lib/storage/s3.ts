import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

import { env } from "@/config/env";
import { NotFoundError } from "@/lib/errors";
import type { PutObjectInput, StorageDriver, StoredObject } from "@/lib/storage/types";

/**
 * Production object storage on any S3-compatible backend (AWS S3, Cloudflare R2, Backblaze B2,
 * MinIO). Config comes from env — `STORAGE_DRIVER` is the only switch business code sees.
 *
 * Objects are **private**: no ACL is set, the bucket is expected to block public access, and
 * `publicUrl()` returns the app-relative `/media/<key>` path, not an S3 URL. Every read goes
 * back through the authorised `/media` route, so couple isolation is unchanged from local dev.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error(
        "STORAGE_DRIVER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
      );
    }
    this.bucket = env.S3_BUCKET;
    const config: S3ClientConfig = {
      region: env.S3_REGION || "auto",
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? Boolean(env.S3_ENDPOINT),
    };
    if (env.S3_ENDPOINT) config.endpoint = env.S3_ENDPOINT;
    this.client = new S3Client(config);
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body),
        ContentType: input.contentType,
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return {
      key: input.key,
      url: this.publicUrl(input.key),
      size: input.body.byteLength,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new NotFoundError();
      return Buffer.from(bytes);
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError();
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    // A delete of a missing object is a success — S3 returns 204 either way.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  publicUrl(key: string): string {
    const prefix = env.STORAGE_PUBLIC_PREFIX.replace(/\/$/, "");
    return `${prefix}/${key.replace(/^\//, "")}`;
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === "NoSuchKey" ||
    e?.name === "NotFound" ||
    e?.$metadata?.httpStatusCode === 404
  );
}
