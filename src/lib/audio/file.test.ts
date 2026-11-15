import { expect, it } from "vitest";
import { audioRange, audioType } from "./file";
it("serves bounded and suffix byte ranges needed by phone audio players", () => {
  expect(audioRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
  expect(audioRange("bytes=80-", 100)).toEqual({ start: 80, end: 99 });
  expect(audioRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
  expect(audioRange("bytes=0-200", 100)).toEqual({ start: 0, end: 99 });
  for (const range of ["bytes=100-", "bytes=4-2", "bytes=-0", "bytes=0-1,3-4", "bytes=-"]) expect(audioRange(range, 100)).toBe(false);
});
it("does not accept arbitrary files disguised as audio", () => {
  expect(audioType(new TextEncoder().encode("<html>not audio at all</html>"))).toBeNull();
  expect(audioType(new TextEncoder().encode("ID3" + "x".repeat(30)))).toBe("audio/mpeg");
  expect(audioType(new TextEncoder().encode("RIFFxxxxWAVE" + "x".repeat(30)))).toBe("audio/wav");
});
