import { afterEach, expect, it, vi } from "vitest";
import { postEmailVerification } from "./email-verification-client";

afterEach(() => vi.unstubAllGlobals());
it("sends capabilities only in the body and bounds a dropped request", async () => {
  const fetchMock = vi.fn().mockImplementation((_url, options) => {
    expect(options.signal).toBeInstanceOf(AbortSignal);
    throw new DOMException("Request timed out", "TimeoutError");
  });
  const timeout = vi.spyOn(AbortSignal, "timeout");
  vi.stubGlobal("fetch", fetchMock);
  expect(await postEmailVerification({ action: "confirm", token: "private-token" })).toMatchObject({ status: "error", message: expect.stringContaining("try again") });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/email-verification");
  expect(timeout).toHaveBeenCalledWith(15_000);
  timeout.mockRestore();
});
it("never treats failed HTTP responses as confirmed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "success" }, { status: 503 })));
  expect(await postEmailVerification({ action: "check" })).toMatchObject({ status: "error" });
});
