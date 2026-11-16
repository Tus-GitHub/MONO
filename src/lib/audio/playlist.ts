export interface MusicTrack { id: string; title: string; version: string }
export interface MusicPreferences {
  musicVolume: number; musicEnabled: boolean; musicMode: "all" | "selected";
  musicOrder: string[]; musicSelectedIds: string[]; musicRepeatOne: boolean;
}
/** A gentle curve: 2% is almost silent, 20% is a quiet background level. */
export function backgroundGain(volume: number) { return Math.pow(Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0)), 2.4); }
export function orderedTracks(tracks: MusicTrack[], order: string[]) {
  const byId = new Map(tracks.map(track => [track.id, track]));
  return [...new Set([...order, ...tracks.map(track => track.id)])].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}
export function musicPlaylist(tracks: MusicTrack[], preferences: Pick<MusicPreferences, "musicMode" | "musicOrder" | "musicSelectedIds">) {
  const selected = new Set(preferences.musicSelectedIds);
  return orderedTracks(tracks, preferences.musicOrder).filter(track => preferences.musicMode === "all" || selected.has(track.id));
}
export function nextMusicId(tracks: MusicTrack[], current: string | null, direction: 1 | -1 = 1) {
  if (!tracks.length) return null;
  const index = tracks.findIndex(track => track.id === current);
  return tracks[(index < 0 ? 0 : index + direction + tracks.length) % tracks.length].id;
}
