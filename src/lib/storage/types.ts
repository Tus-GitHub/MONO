/**
 * Storage abstraction. Business code depends on `StorageDriver`, never on a concrete backend,
 * so the local-disk driver used in development can be swapped for S3/R2 in production by
 * changing `STORAGE_DRIVER` alone.
 */
export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
}

export interface StoredObject {
  key: string;
  url: string;
  size: number;
  contentType?: string;
}

export interface StorageDriver {
  readonly name: string;
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** App-relative URL the client can request; a route handler streams it after authorization. */
  publicUrl(key: string): string;
}
