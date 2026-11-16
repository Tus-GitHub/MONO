import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { env } from "@/config/env";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"); const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { getSoloGameSummary, actOnSoloGame } from "@/server/services/solo-game-service";
import { togetherSnapshot } from "@/server/services/together-service";
import { createSoloRound, advanceSoloRound } from "@/lib/solo-games/engine";
import { SOLO_KINDS, type SoloChallenge, type SoloReplay, type SoloKind } from "@/lib/solo-games/catalog";
import { POST } from "@/app/api/together/solo/route";

let owner: string, partner: string, outsider: string, otherPartner: string, couple: string, otherCouple: string;
beforeEach(async () => {
  const run = randomUUID();
  async function pair(label: string) {
    const a = await prisma.user.create({ data: { name: `${label} A`, email: `${label}-a-${run}@example.invalid`, emailVerified: new Date() } });
    const b = await prisma.user.create({ data: { name: `${label} B`, email: `${label}-b-${run}@example.invalid`, emailVerified: new Date() } });
    const c = await prisma.couple.create({ data: { createdById: a.id, inviteCode: `${label}-${run}`, status: "ACTIVE", members: { create: [{ userId: a.id, role: "OWNER", status: "ACTIVE" }, { userId: b.id, role: "PARTNER", status: "ACTIVE" }] } } });
    return [a.id, b.id, c.id];
  }
  [owner, partner, couple] = await pair("solo"); [outsider, otherPartner, otherCouple] = await pair("foreign");
});
afterEach(async () => {
  await prisma.soloGameScore.deleteMany({ where: { coupleId: { in: [couple, otherCouple] } } });
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider, otherPartner] } } });
});
afterAll(() => prisma.$disconnect());
const start = async (actor: string, kind: SoloKind) => asUser(actor, () => actOnSoloGame({ action: "start", kind, rulesVersion: 2 })) as Promise<SoloChallenge>;
function play(ticket: SoloChallenge, turns = 600): SoloReplay {
  let round = createSoloRound(ticket.kind, ticket.seed, ticket.rulesVersion ?? 1); const moves: [number, number][] = [];
  for (let i = 0; i < turns && !round.state.over; i++) {
    let input = round.kind === "EMOJI_BOUNCE" ? Math.round(round.state.x) : i % 4;
    if (round.kind === "SNAKE") {
      const occupied = new Set(round.state.body.slice(0, -1)), seen = new Set<number>();
      const queue: { cell: number; first: number }[] = [{ cell: round.state.body[0], first: -1 }];
      for (let index = 0; index < queue.length; index++) {
        const item = queue[index];
        if (item.cell === round.state.food) { input = item.first; break; }
        for (const [dir, dx, dy] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]]) {
          const x = item.cell % 18 + dx, y = Math.floor(item.cell / 18) + dy, cell = y * 18 + x;
          if (x < 0 || x >= 18 || y < 0 || y >= 18 || occupied.has(cell) || seen.has(cell)) continue;
          seen.add(cell); queue.push({ cell, first: item.first < 0 ? dir : item.first });
        }
      }
    }
    const next = advanceSoloRound(round, input);
    if (next !== round) { moves.push([round.state.frame, input]); round = next; }
  }
  return { frames: round.state.frame, moves };
}
const save = (actor: string, ticket: SoloChallenge, replay: SoloReplay) => asUser(actor, () => actOnSoloGame({ action: "save", token: ticket.token, ...replay }));

it("persists each game independently and shares only this couple's personal bests", async () => {
  for (const kind of SOLO_KINDS) { const ticket = await start(owner, kind); await save(owner, ticket, play(ticket)); }
  const other = await start(partner, "EMOJI_BOUNCE"); await save(partner, other, play(other, 900));
  const mine = await asUser(owner, getSoloGameSummary), theirs = await asUser(partner, getSoloGameSummary);
  expect(mine.scores).toHaveLength(4); expect(theirs.scores).toEqual(mine.scores);
  expect(mine.scores.find(s => s.kind === "EMOJI_BOUNCE" && s.userId === owner)!.bestScore).toBeGreaterThan(0);
  expect((await asUser(outsider, getSoloGameSummary)).scores).toEqual([]);
  const snapshot = await asUser(partner, () => togetherSnapshot());
  expect(snapshot.soloScores).toHaveLength(mine.scores.length); expect(snapshot.soloScores).toEqual(expect.arrayContaining(mine.scores)); expect(snapshot.games).toEqual([]);
  expect(mine.scores.find(s => s.kind === "SNAKE")!.bestScore).toBeGreaterThan(0);
  expect((await asUser(owner, getSoloGameSummary)).scores).toEqual(mine.scores);
});
it("keeps the maximum with duplicate, lower and concurrent saves", async () => {
  const ticket = await start(owner, "EMOJI_BOUNCE"), high = play(ticket, 1500), low = play(ticket, 300);
  await Promise.all([save(owner, ticket, high), save(owner, ticket, low)]);
  const best = (await asUser(owner, getSoloGameSummary)).scores[0].bestScore;
  expect(best).toBeGreaterThan(3);
  await save(owner, ticket, low); await save(owner, ticket, high);
  expect((await asUser(owner, getSoloGameSummary)).scores).toEqual([{ kind: "EMOJI_BOUNCE", userId: owner, bestScore: best }]);
});
it("accepts both legacy and faster rounds after a deployment and delayed retry", async () => {
  const old = await asUser(owner, () => actOnSoloGame({ action: "start", kind: "EMOJI_BOUNCE" })) as SoloChallenge;
  const current = await start(owner, "EMOJI_BOUNCE");
  expect(old.rulesVersion).toBe(1); expect(current.rulesVersion).toBe(2);
  // Tickets already issued by production have no rulesVersion claim at all.
  old.token = await new SignJWT({ seed: old.seed, kind: old.kind, coupleId: couple }).setProtectedHeader({ alg: "HS256" }).setSubject(owner).setAudience("amor-solo-games-v1").setIssuedAt().setExpirationTime("24h").sign(new TextEncoder().encode(env.AUTH_SECRET));
  const oldResult = await save(owner, old, play(old, 1200));
  const currentResult = await save(owner, current, play(current, 1200));
  expect("score" in oldResult && oldResult.score).toBeGreaterThan(0);
  expect("score" in currentResult && currentResult.score).toBeGreaterThan(0);
  await save(owner, old, play(old, 1200));
  expect((await asUser(owner, getSoloGameSummary)).scores[0].bestScore).toBe(Math.max("score" in oldResult ? oldResult.score : 0, "score" in currentResult ? currentResult.score : 0));
});
it("rejects another person's ticket, changed totals and malformed replays", async () => {
  const ticket = await start(owner, "EMOJI_BOUNCE"), replay = play(ticket);
  await expect(save(partner, ticket, replay)).rejects.toThrow();
  await expect(save(outsider, ticket, replay)).rejects.toThrow();
  await expect(save(owner, { ...ticket, token: `${ticket.token.slice(0,-8)}tampered` }, replay)).rejects.toThrow();
  await expect(asUser(owner, () => actOnSoloGame({ action: "save", token: ticket.token, ...replay, score: 999999 }))).rejects.toThrow();
  await expect(save(owner, ticket, { frames: 20, moves: [[5,100],[2,200]] })).rejects.toThrow();
  expect(await prisma.soloGameScore.count({ where: { coupleId: couple } })).toBe(0);
});
it("rejects saving once the shared space is no longer active", async () => {
  const ticket = await start(owner, "EMOJI_BOUNCE");
  await prisma.couple.update({ where: { id: couple }, data: { status: "ARCHIVED" } });
  await expect(save(owner, ticket, play(ticket))).rejects.toThrow();
});
it("enforces same-origin JSON requests and returns private uncached scores", async () => {
  const body = JSON.stringify({ action: "start", kind: "MERGE_2048" });
  const blocked = await asUser(owner, () => POST(new Request("http://localhost:3000/api/together/solo", { method: "POST", headers: { "content-type": "application/json", origin: "https://foreign.invalid" }, body })));
  expect(blocked.status).toBe(403);
  const valid = await asUser(owner, () => POST(new Request("http://localhost:3000/api/together/solo", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body })));
  expect(valid.status).toBe(200); expect(valid.headers.get("cache-control")).toBe("private, no-store");
});
