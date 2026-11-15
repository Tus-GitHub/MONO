import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

export const PRIVATE_TEXT_PREFIX = "mono-private:v1:";
export const PRIVATE_FILE_MAGIC = Buffer.from("MONO-PRIVATE-FILE-V1\0");

/** Server-managed encryption at rest. This key is deliberately separate from chat E2EE keys. */
export function createPrivateCrypto(encodedKey: string) {
  const root = Buffer.from(encodedKey, "base64");
  if (root.length !== 32 || root.toString("base64") !== encodedKey) throw new Error("Private data encryption requires a valid 32-byte key.");
  const derive = (purpose: string) => Buffer.from(hkdfSync("sha256", root, "MONO private data v1", purpose, 32));
  const encryptionKey = derive("authenticated encryption");
  const lookupKey = derive("blind identity lookup");
  function seal(bytes: Uint8Array, context: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(`MONO:v1:${context}`));
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  }
  function open(bytes: Uint8Array, context: string): Buffer {
    try {
      const input = Buffer.from(bytes);
      if (input.length < 28) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, input.subarray(0, 12), { authTagLength: 16 });
      decipher.setAAD(Buffer.from(`MONO:v1:${context}`));
      decipher.setAuthTag(input.subarray(12, 28));
      return Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]);
    } catch { throw new Error("Private data could not be authenticated. Check the encryption key and stored data."); }
  }
  return {
    seal, open,
    encryptText(value: string, context: string) { return PRIVATE_TEXT_PREFIX + seal(Buffer.from(value), context).toString("base64url"); },
    decryptText(value: string, context: string) {
      if (!value.startsWith(PRIVATE_TEXT_PREFIX)) return value;
      return open(Buffer.from(value.slice(PRIVATE_TEXT_PREFIX.length), "base64url"), context).toString("utf8");
    },
    lookup(value: string, context: string) { return createHmac("sha256", lookupKey).update(`${context}\0${value}`).digest("hex"); },
    encryptFile(value: Uint8Array, key: string) { return Buffer.concat([PRIVATE_FILE_MAGIC, seal(value, `storage:${key}`)]); },
    decryptFile(value: Uint8Array, key: string) {
      const bytes = Buffer.from(value);
      return bytes.subarray(0, PRIVATE_FILE_MAGIC.length).equals(PRIVATE_FILE_MAGIC)
        ? open(bytes.subarray(PRIVATE_FILE_MAGIC.length), `storage:${key}`) : bytes;
    },
  };
}
export type PrivateCrypto = ReturnType<typeof createPrivateCrypto>;
