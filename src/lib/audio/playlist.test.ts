import { expect, it } from "vitest";
import { backgroundGain, musicPlaylist, nextMusicId, orderedTracks } from "./playlist";
const tracks = ["a", "b", "c"].map(id => ({ id, title: id, version: "1" }));
it("makes low music percentages gentle, monotonic and bounded", () => {
  expect(backgroundGain(0)).toBe(0); expect(backgroundGain(0.02)).toBeLessThan(0.0001);
  expect(backgroundGain(0.2)).toBeGreaterThan(0.015); expect(backgroundGain(0.2)).toBeLessThan(0.025);
  expect(backgroundGain(0.5)).toBeGreaterThan(backgroundGain(0.2)); expect(backgroundGain(1)).toBe(1);
  expect(backgroundGain(-1)).toBe(0); expect(backgroundGain(5)).toBe(1); expect(backgroundGain(NaN)).toBe(0);
});
it("keeps the user's order, appends new songs and ignores deleted/duplicate IDs", () => {
  expect(orderedTracks(tracks, ["b", "gone", "b", "a"]).map(track => track.id)).toEqual(["b", "a", "c"]);
});
it("selected mode never silently plays unselected songs or falls back to all", () => {
  expect(musicPlaylist(tracks, { musicMode: "selected", musicSelectedIds: ["a", "c"], musicOrder: ["c", "b", "a"] }).map(track => track.id)).toEqual(["c", "a"]);
  expect(musicPlaylist(tracks, { musicMode: "selected", musicSelectedIds: ["deleted"], musicOrder: [] })).toEqual([]);
});
it("wraps the playlist in both directions and handles an empty list", () => {
  expect(nextMusicId(tracks, "c")).toBe("a"); expect(nextMusicId(tracks, "a", -1)).toBe("c");
  expect(nextMusicId(tracks, "removed")).toBe("a"); expect(nextMusicId([], "a")).toBeNull();
});
