import { afterEach, expect, it, vi } from "vitest";

import { downscaleImage } from "@/lib/images/client-resize";
import { validateImageUpload } from "@/lib/storage/image-rules";

function browserAdapter(output: Blob | null) {
  const bitmap = { width: 4032, height: 3024, close: vi.fn() };
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob: vi.fn((callback: BlobCallback) => callback(output)),
  };
  const decode = vi.fn().mockResolvedValue(bitmap);
  vi.stubGlobal("window", {});
  vi.stubGlobal("createImageBitmap", decode);
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  return { bitmap, canvas, decode, drawImage };
}

afterEach(() => vi.unstubAllGlobals());

it.each(["heic", "heif"])("keeps a successfully converted %s JPEG even when it is larger than the original", async (extension) => {
  const file = new File(["compact original"], `portrait.${extension}`, { type: `image/${extension}` });
  const jpeg = new Blob([new Uint8Array(128)], { type: "image/jpeg" });
  const adapter = browserAdapter(jpeg);

  const result = await downscaleImage(file);

  expect(result).not.toBe(file);
  expect(result.name).toBe("portrait.jpg");
  expect(result.type).toBe("image/jpeg");
  expect(result.size).toBeGreaterThan(file.size);
  expect(validateImageUpload(file).ok).toBe(false);
  expect(validateImageUpload(result)).toEqual({ ok: true });
  expect(adapter.decode).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
  expect(adapter.drawImage).toHaveBeenCalledWith(adapter.bitmap, 0, 0, 2560, 1920);
  expect(adapter.bitmap.close).toHaveBeenCalledOnce();
});

it("returns the original for normal validation when both browser decode attempts fail", async () => {
  const file = new File(["undecodable"], "portrait.heic", { type: "image/heic" });
  const adapter = browserAdapter(null);
  adapter.decode.mockRejectedValue(new Error("Unsupported image"));

  expect(await downscaleImage(file)).toBe(file);
  expect(adapter.decode).toHaveBeenCalledTimes(2);
  expect(adapter.decode).toHaveBeenLastCalledWith(file);
  expect(adapter.canvas.getContext).not.toHaveBeenCalled();
  expect(validateImageUpload(file).ok).toBe(false);
});

it("preserves the original and releases its bitmap when the canvas cannot encode", async () => {
  const file = new File(["original"], "portrait.heic", { type: "image/heic" });
  const adapter = browserAdapter(null);

  expect(await downscaleImage(file)).toBe(file);
  expect(adapter.bitmap.close).toHaveBeenCalledOnce();
});

it("still keeps an accepted PNG when conversion would increase upload size", async () => {
  const file = new File([new Uint8Array(1_200_000)], "portrait.png", { type: "image/png" });
  const adapter = browserAdapter(new Blob([new Uint8Array(1_300_000)], { type: "image/jpeg" }));

  expect(await downscaleImage(file)).toBe(file);
  expect(validateImageUpload(file)).toEqual({ ok: true });
  expect(adapter.bitmap.close).toHaveBeenCalledOnce();
});
