import { MAX_SOLO_FRAMES, SOLO_RULES_VERSION, type SoloRulesVersion } from "./catalog";

export const BOUNCE = { width: 360, height: 520, radius: 14, paddleY: 476, paddleWidth: 88, paddleHeight: 10, hz: 60 } as const;
export interface BounceState { x: number; y: number; vx: number; vy: number; paddle: number; score: number; frame: number; over: boolean; rulesVersion: SoloRulesVersion }
export const clampPaddle = (x: number) => Math.max(BOUNCE.paddleWidth / 2, Math.min(BOUNCE.width - BOUNCE.paddleWidth / 2, Math.round(x)));
export function newBounce(seed: number, rulesVersion: SoloRulesVersion = SOLO_RULES_VERSION): BounceState {
  const speed = rulesVersion === 1 ? 1 : 1.12;
  const vx = (seed % 2 ? 100 : -100) * speed;
  return { x: 180, y: 160, vx, vy: 215 * speed, paddle: 180, score: 0, frame: 0, over: false, rulesVersion };
}
/** Fixed physics steps are shared by the player and the score verifier. */
export function stepBounce(current: BounceState, input: number): BounceState {
  if (current.over) return current;
  const s = { ...current, paddle: clampPaddle(input), frame: current.frame + 1 };
  const r = BOUNCE.radius;
  s.x += s.vx / BOUNCE.hz; s.y += s.vy / BOUNCE.hz;
  if (s.x < r) { s.x = r + (r - s.x); s.vx = Math.abs(s.vx); }
  if (s.x > BOUNCE.width - r) { s.x = 2 * (BOUNCE.width - r) - s.x; s.vx = -Math.abs(s.vx); }
  if (s.y < r) { s.y = r + (r - s.y); s.vy = Math.abs(s.vy); }
  if (s.vy > 0 && current.y + r <= BOUNCE.paddleY && s.y + r >= BOUNCE.paddleY) {
    // Sweep to the paddle plane so fast frames cannot skip the hit surface.
    const crossing = (BOUNCE.paddleY - r - current.y) / (s.y - current.y);
    const hitX = current.x + (s.x - current.x) * crossing;
    if (Math.abs(hitX - s.paddle) <= BOUNCE.paddleWidth / 2 + r * 0.5) {
      s.score += 1;
      const speed = Math.min(570, 245 + s.score * 9) * (s.rulesVersion === 1 ? 1 : 1.12);
      const offset = Math.max(-1, Math.min(1, (hitX - s.paddle) / (BOUNCE.paddleWidth / 2)));
      s.vx = Math.sin(offset * 1.02) * speed;
      if (Math.abs(s.vx) < 55) s.vx = (s.vx < 0 || (s.vx === 0 && current.vx < 0) ? -1 : 1) * 55;
      s.vy = -Math.sqrt(speed * speed - s.vx * s.vx);
      s.y = BOUNCE.paddleY - r;
    }
  }
  s.over = s.y + r >= BOUNCE.height || s.frame >= MAX_SOLO_FRAMES;
  return s;
}
