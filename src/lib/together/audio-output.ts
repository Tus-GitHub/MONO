export type OutputDevice = { deviceId: string; label: string };
export type OutputMediaDevices = MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };

/** Only offer outputs actually exposed by the browser; never invent a speaker/earpiece ID. */
export async function audioOutputs(devices: Pick<MediaDevices, "enumerateDevices">): Promise<OutputDevice[]> {
  const outputs = (await devices.enumerateDevices()).filter((device) => device.kind === "audiooutput" && device.deviceId);
  const unique = new Map(outputs.map((device) => [device.deviceId, { deviceId: device.deviceId, label: device.label || "Audio output" }]));
  unique.delete("default");
  return [{ deviceId: "", label: "Phone / system default" }, ...unique.values()];
}

export async function routeCallAudio(element: HTMLAudioElement, deviceId: string) {
  if (typeof element.setSinkId !== "function") throw new Error("This browser uses your phone’s audio output controls. Choose speaker, headphones or Bluetooth there.");
  await element.setSinkId(deviceId);
}
