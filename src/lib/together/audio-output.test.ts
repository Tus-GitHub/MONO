import { expect, it, vi } from "vitest";
import { audioOutputs, routeCallAudio } from "./audio-output";

it("lists actual outputs without leaking inputs or duplicating the default route", async () => {
  const enumerateDevices = vi.fn().mockResolvedValue([
    { kind: "audioinput", deviceId: "mic", label: "Microphone" },
    { kind: "audiooutput", deviceId: "default", label: "Default" },
    { kind: "audiooutput", deviceId: "bt", label: "Headphones" },
    { kind: "audiooutput", deviceId: "bt", label: "Headphones" },
    { kind: "audiooutput", deviceId: "", label: "" },
  ]);
  expect(await audioOutputs({ enumerateDevices })).toEqual([
    { deviceId: "", label: "Phone / system default" }, { deviceId: "bt", label: "Headphones" },
  ]);
});
it("switches the existing call player without reacquiring media", async () => {
  const setSinkId = vi.fn().mockResolvedValue(undefined);
  await routeCallAudio({ setSinkId } as unknown as HTMLAudioElement, "headphones");
  expect(setSinkId).toHaveBeenCalledOnce();
  expect(setSinkId).toHaveBeenCalledWith("headphones");
});
it("keeps denied routing a failure instead of displaying a fake speaker toggle", async () => {
  const denied = new DOMException("Not permitted", "NotAllowedError");
  await expect(routeCallAudio({ setSinkId: vi.fn().mockRejectedValue(denied) } as unknown as HTMLAudioElement, "speaker")).rejects.toBe(denied);
  await expect(routeCallAudio({} as HTMLAudioElement, "speaker")).rejects.toThrow("phone’s audio output controls");
});
