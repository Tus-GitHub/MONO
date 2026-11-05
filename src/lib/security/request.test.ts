import { expect, it, vi } from "vitest";
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
import { assertSameOrigin, readBoundedJson } from "./request";

it("requires the configured origin for cookie-authenticated mutations", () => {
  expect(() => assertSameOrigin(new Request("https://mono.test/api", { headers: { origin: "https://mono.test" } }))).not.toThrow();
  for (const origin of [null, "https://attacker.test", "null"]) {
    expect(() => assertSameOrigin(new Request("https://mono.test/api", { headers: origin ? { origin } : {} }))).toThrow();
  }
  expect(() => assertSameOrigin(new Request("https://mono.test/api", { headers: { origin: "https://mono.test", "sec-fetch-site": "cross-site" } }))).toThrow();
});

it("bounds actual streamed bytes even with absent or false length headers", async () => {
  const request = new Request("https://mono.test/api", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: JSON.stringify({ text: "x".repeat(100) }) });
  await expect(readBoundedJson(request, 20)).rejects.toMatchObject({ httpStatus: 413 });
});

it("accepts bounded JSON and rejects malformed bodies and content types", async () => {
  const request = (body: string, type = "application/json") => new Request("https://mono.test/api", { method: "POST", headers: { "content-type": type }, body });
  expect(await readBoundedJson(request('{"ok":true}'))).toEqual({ ok: true });
  await expect(readBoundedJson(request("{"))).rejects.toMatchObject({ httpStatus: 422 });
  await expect(readBoundedJson(request("{}", "text/plain"))).rejects.toMatchObject({ httpStatus: 415 });
});
