import { MAX_SOLO_FRAMES, nextRandom, type Direction } from "./catalog";
export const SNAKE_SIZE = 18;
export interface SnakeState { body: number[]; food: number; direction: Direction; seed: number; score: number; frame: number; over: boolean }
function foodFor(body: number[], seed: number) {
  const free = Array.from({ length: SNAKE_SIZE ** 2 }, (_, i) => i).filter(i => !body.includes(i));
  return free.length ? free[seed % free.length] : -1;
}
export function newSnake(seed: number): SnakeState {
  const body = [9 * SNAKE_SIZE + 8, 9 * SNAKE_SIZE + 7, 9 * SNAKE_SIZE + 6];
  return { body, food: foodFor(body, seed), direction: 1, seed, score: 0, frame: 0, over: false };
}
export function stepSnake(current: SnakeState, input: Direction): SnakeState {
  if (current.over) return current;
  const direction = (input + 2) % 4 === current.direction ? current.direction : input;
  const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][direction];
  const x = current.body[0] % SNAKE_SIZE + dx, y = Math.floor(current.body[0] / SNAKE_SIZE) + dy;
  const head = y * SNAKE_SIZE + x, ate = head === current.food;
  const occupied = ate ? current.body : current.body.slice(0, -1);
  const frame = current.frame + 1;
  if (x < 0 || y < 0 || x >= SNAKE_SIZE || y >= SNAKE_SIZE || occupied.includes(head)) return { ...current, frame, over: true };
  const body = [head, ...current.body]; if (!ate) body.pop();
  const seed = ate ? nextRandom(current.seed) : current.seed;
  const food = ate ? foodFor(body, seed) : current.food;
  return { body, food, seed, direction, frame, score: current.score + (ate ? 10 : 0), over: food < 0 || frame >= MAX_SOLO_FRAMES };
}
