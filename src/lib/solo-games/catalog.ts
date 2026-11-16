export const SOLO_GAMES = {
  EMOJI_BOUNCE: { slug: "emoji-bounce", name: "Emoji Bounce", emoji: "🥰", description: "Keep the emoji in the air. Bounce off your paddle, the walls and the roof — never the floor." },
  SNAKE: { slug: "snake", name: "Snake", emoji: "🐍", description: "Collect hearts, grow your snake and beat your best. Avoid the walls and your own tail." },
  MERGE_2048: { slug: "2048", name: "2048", emoji: "🔢", description: "Slide matching tiles together. Build bigger numbers and keep going beyond 2048." },
} as const;
export type SoloKind = keyof typeof SOLO_GAMES;
export const SOLO_KINDS = Object.keys(SOLO_GAMES) as SoloKind[];
export interface SoloScore { kind: SoloKind; userId: string; bestScore: number }
export interface SoloChallenge { token: string; seed: number; kind: SoloKind }
export interface SoloReplay { frames: number; moves: [number, number][] }
export const MAX_SOLO_FRAMES = 36_000;
export type Direction = 0 | 1 | 2 | 3; // up, right, down, left
export function nextRandom(seed: number): number { return (Math.imul(seed, 1664525) + 1013904223) >>> 0; }
