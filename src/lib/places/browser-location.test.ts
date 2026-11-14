import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getBrowserLocation } from "./browser-location";

let position: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  position = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: position } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("waits for an explicit request and returns approximate coordinates for nearby search", async () => {
  expect(position).not.toHaveBeenCalled();
  position.mockImplementation((success: PositionCallback) => success({ coords: { latitude: 26.9154576, longitude: 75.8189817 } } as GeolocationPosition));
  await expect(getBrowserLocation(new AbortController().signal)).resolves.toEqual({ latitude: 26.915, longitude: 75.819 });
  expect(position.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  expect(vi.getTimerCount()).toBe(0);
});
it("gives useful manual-entry feedback when permission is denied", async () => {
  position.mockImplementation((_success, failure: PositionErrorCallback) => failure({ code: 1 } as GeolocationPositionError));
  await expect(getBrowserLocation(new AbortController().signal)).rejects.toThrow("permission was denied. Enter a city");
  expect(vi.getTimerCount()).toBe(0);
});
it("releases a request even if the permission prompt never produces a callback", async () => {
  const result = expect(getBrowserLocation(new AbortController().signal)).rejects.toThrow("too long");
  await vi.advanceTimersByTimeAsync(12_000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});
it("ignores a late position after cancellation when the picker closes or manual city entry starts", async () => {
  const controller = new AbortController();
  const pending = getBrowserLocation(controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  position.mock.calls[0][0]({ coords: { latitude: 26.9, longitude: 75.8 } });
  expect(vi.getTimerCount()).toBe(0);
});
it("supports manual fallback in browsers without geolocation", async () => {
  vi.stubGlobal("navigator", {});
  await expect(getBrowserLocation(new AbortController().signal)).rejects.toThrow("Enter a city or area");
});
