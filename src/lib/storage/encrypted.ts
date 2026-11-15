import type { StorageDriver, PutObjectInput } from "./types";
import type { PrivateCrypto } from "@/lib/privacy/crypto";

export class EncryptedStorageDriver implements StorageDriver {
  constructor(private readonly inner: StorageDriver, private readonly crypto: () => PrivateCrypto) {}
  get name() { return this.inner.name; }
  async put(input: PutObjectInput) {
    const result = await this.inner.put({ key: input.key, body: this.crypto().encryptFile(input.body, input.key), contentType: "application/octet-stream" });
    return { ...result, size: input.body.byteLength, contentType: input.contentType };
  }
  async get(key: string) { return this.crypto().decryptFile(await this.inner.get(key), key); }
  delete(key: string) { return this.inner.delete(key); }
  exists(key: string) { return this.inner.exists(key); }
  publicUrl(key: string) { return this.inner.publicUrl(key); }
}
