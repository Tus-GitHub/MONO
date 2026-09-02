import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/lib/errors";

// The driver reads config from `@/config/env` at construction — give it enough to build.
vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/mono_test");
vi.stubEnv("AUTH_SECRET", "test-secret-at-least-thirty-two-characters-long");
vi.stubEnv("S3_BUCKET", "mono-media");
vi.stubEnv("S3_ACCESS_KEY_ID", "AKIA_TEST");
vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret_test");
vi.stubEnv("S3_REGION", "auto");
vi.stubEnv("S3_ENDPOINT", "https://acc.r2.cloudflarestorage.com");

const { S3StorageDriver } = await import("./s3");

afterEach(() => vi.restoreAllMocks());

function driverWithSend(send: (cmd: unknown) => Promise<unknown>) {
  vi.spyOn(S3Client.prototype, "send").mockImplementation(send as never);
  return new S3StorageDriver();
}

describe("S3StorageDriver", () => {
  it("put issues a private PutObject and returns the app-relative /media url", async () => {
    let cmd: PutObjectCommand | undefined;
    const d = driverWithSend(async (c) => {
      cmd = c as PutObjectCommand;
      return {};
    });
    const out = await d.put({
      key: "couples/c1/dates/d1/photos/abc.webp",
      body: Buffer.from("bytes"),
      contentType: "image/webp",
    });
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd!.input.Bucket).toBe("mono-media");
    expect(cmd!.input.Key).toBe("couples/c1/dates/d1/photos/abc.webp");
    expect(cmd!.input.ContentType).toBe("image/webp");
    expect("ACL" in cmd!.input).toBe(false); // never public
    expect(out.url).toBe("/media/couples/c1/dates/d1/photos/abc.webp");
    expect(out.size).toBe(5);
  });

  it("get streams the object body to a Buffer", async () => {
    const d = driverWithSend(async (c) => {
      expect(c).toBeInstanceOf(GetObjectCommand);
      return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
    });
    const buf = await d.get("users/u1/avatar/x.webp");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it("get maps a missing object to NotFoundError (so /media returns 404)", async () => {
    const d = driverWithSend(async () => {
      const e = new Error("nope") as Error & { name: string };
      e.name = "NoSuchKey";
      throw e;
    });
    await expect(d.get("couples/c1/nope.webp")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("exists is true on HEAD 200, false on 404, and rethrows anything else", async () => {
    expect(await driverWithSend(async (c) => {
      expect(c).toBeInstanceOf(HeadObjectCommand);
      return {};
    }).exists("k")).toBe(true);

    expect(
      await driverWithSend(async () => {
        throw Object.assign(new Error("gone"), { $metadata: { httpStatusCode: 404 } });
      }).exists("k"),
    ).toBe(false);

    await expect(
      driverWithSend(async () => {
        throw Object.assign(new Error("boom"), { $metadata: { httpStatusCode: 500 } });
      }).exists("k"),
    ).rejects.toThrow("boom");
  });

  it("delete issues DeleteObject and treats a missing key as success", async () => {
    let cmd: unknown;
    const d = driverWithSend(async (c) => {
      cmd = c;
      return {};
    });
    await expect(d.delete("couples/c1/x.webp")).resolves.toBeUndefined();
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
  });
});
