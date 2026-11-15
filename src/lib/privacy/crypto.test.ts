import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { createPrivateCrypto, PRIVATE_TEXT_PREFIX } from "./crypto";
import { privateDataCodec } from "./prisma-extension";
import { EncryptedStorageDriver } from "@/lib/storage/encrypted";
import type { StorageDriver } from "@/lib/storage/types";

const crypto = createPrivateCrypto(randomBytes(32).toString("base64"));
it("randomizes ciphertext and authenticates its key, field and contents", () => {
  const text = "Private note with emoji 💜";
  const first = crypto.encryptText(text, "Memory.body");
  expect(first).toMatch(new RegExp(`^${PRIVATE_TEXT_PREFIX}`));
  expect(first).not.toContain(text);
  expect(crypto.encryptText(text, "Memory.body")).not.toBe(first);
  expect(crypto.decryptText(first, "Memory.body")).toBe(text);
  expect(() => crypto.decryptText(first, "User.name")).toThrow("authenticated");
  expect(() => createPrivateCrypto(randomBytes(32).toString("base64")).decryptText(first, "Memory.body")).toThrow("authenticated");
  const bytes = Buffer.from(first.slice(PRIVATE_TEXT_PREFIX.length), "base64url"); bytes[20] ^= 1;
  expect(() => crypto.decryptText(PRIVATE_TEXT_PREFIX + bytes.toString("base64url"), "Memory.body")).toThrow("authenticated");
  expect(() => createPrivateCrypto("short")).toThrow("32-byte");
});
it("separates blind identity lookups from encryption and from other field lookups", () => {
  expect(crypto.lookup("a@b.test", "identity:email")).toBe(crypto.lookup("a@b.test", "identity:email"));
  expect(crypto.lookup("a@b.test", "identity:email")).not.toBe(crypto.lookup("a@b.test", "User.name"));
});
it("encrypts nested private fields, JSON, and bytes while preserving operational metadata", () => {
  const codec = privateDataCodec(() => crypto);
  const body = { title: "Private date", status: "PLANNED", activities: { createMany: { data: [{ title: "Surprise" }] } } };
  const encoded = codec.data("Date", body);
  expect(JSON.stringify(encoded)).not.toContain("Private date");
  expect(JSON.stringify(encoded)).not.toContain("Surprise");
  expect(encoded.status).toBe("PLANNED");
  const notification = codec.data("Notification", { title: "Reminder", data: { secret: "note" } });
  expect(codec.decode("Notification", notification)).toEqual({ title: "Reminder", data: { secret: "note" } });
  const image = codec.data("ChatImage", { bytes: Buffer.from("client E2EE ciphertext"), viewLimit: 2 });
  expect(Buffer.from(image.bytes as Uint8Array).toString()).not.toContain("client E2EE ciphertext");
  expect(codec.decode("ChatImage", image)).toEqual({ bytes: new Uint8Array(Buffer.from("client E2EE ciphertext")), viewLimit: 2 });
  const user = codec.data("User", { email: "Person@Example.test", name: "Private name" });
  expect(user.emailLookup).toBe(crypto.lookup("person@example.test", "identity:email"));
  expect(codec.args("User", { where: { email: "person@example.test" } }, "findUnique")).toEqual({ where: { emailLookup: user.emailLookup } });
  expect(() => codec.args("User", { where: { email: { contains: "person" } } }, "findMany")).toThrow("exact lookup");
});
it("wraps storage bytes, binds them to their key and keeps plaintext response metadata", async () => {
  const objects = new Map<string, Buffer>();
  const inner: StorageDriver = {
    name: "memory", publicUrl: (key) => `/media/${key}`,
    async put(input) { objects.set(input.key, Buffer.from(input.body)); return { key: input.key, size: input.body.length, contentType: input.contentType, url: this.publicUrl(input.key) }; },
    async get(key) { return objects.get(key)!; }, async delete(key) { objects.delete(key); }, async exists(key) { return objects.has(key); },
  };
  const storage = new EncryptedStorageDriver(inner, () => crypto);
  const image = Buffer.from("private image bytes");
  const saved = await storage.put({ key: "photo.webp", body: image, contentType: "image/webp" });
  expect(saved).toMatchObject({ size: image.length, contentType: "image/webp" });
  expect(objects.get("photo.webp")!.includes(image)).toBe(false);
  expect(await storage.get("photo.webp")).toEqual(image);
  objects.set("wrong.webp", objects.get("photo.webp")!);
  await expect(storage.get("wrong.webp")).rejects.toThrow("authenticated");
  objects.set("legacy.webp", image);
  expect(await storage.get("legacy.webp")).toEqual(image);
});
