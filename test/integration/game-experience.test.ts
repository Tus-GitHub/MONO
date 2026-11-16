import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"); const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { togetherSnapshot, actOnGame, getGame } from "@/server/services/together-service";
import { registerChatKey } from "@/server/services/chat-security-service";
const keyId = "ab".repeat(32);

let owner: string, partner: string, outsider: string, otherPartner: string, couple: string, otherCouple: string;
beforeEach(async () => {
  const run = randomUUID();
  const make = async (role: string) => {
    const a = await prisma.user.create({ data: { name: `${role}-a-${run}`, email: `${role}-a-${run}@example.invalid`, emailVerified: new Date() } });
    const b = await prisma.user.create({ data: { name: `${role}-b-${run}`, email: `${role}-b-${run}@example.invalid`, emailVerified: new Date() } });
    const space = await prisma.couple.create({ data: { createdById: a.id, inviteCode: `${role}-${run}`, status: "ACTIVE", members: { create: [{ userId: a.id, role: "OWNER", status: "ACTIVE" }, { userId: b.id, role: "PARTNER", status: "ACTIVE" }] } } });
    return { a: a.id, b: b.id, space: space.id };
  };
  const own = await make("together"), other = await make("other"); owner = own.a; partner = own.b; couple = own.space; outsider = other.a; otherPartner = other.b; otherCouple = other.space;
  await asUser(owner, () => registerChatKey(keyId));
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { id: { in: [couple, otherCouple].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, partner, outsider, otherPartner].filter(Boolean) } } });
});
afterAll(() => prisma.$disconnect());

import { gameChatSignals, sendGameChatSignal } from "@/server/services/game-chat-service";
import { sendEncryptedDocument } from "@/server/services/chat-document-service";
import { sendEncryptedSticker } from "@/server/services/chat-sticker-service";
import { getAdminDashboard } from "@/server/services/moderation-service";
async function activeGame() {
  const invited = await asUser(owner, () => actOnGame({ action: "create", kind: "TIC_TAC_TOE", clientNonce: randomUUID() }));
  return asUser(partner, () => actOnGame({ action: "accept", id: invited.id, version: invited.version }));
}
it("requires rematch consent, starts only once, switches starters and never sends another chat invite", async () => {
  const active = await activeGame();
  await expect(asUser(owner, () => actOnGame({ action: "rematch-request", id: active.id, version: active.version }))).rejects.toThrow();
  const finished = await asUser(owner, () => actOnGame({ action: "resign", id: active.id, version: active.version }));
  const count = await prisma.chatMessage.count({ where: { coupleId: couple } });
  const requested = await asUser(owner, () => actOnGame({ action: "rematch-request", id: finished.id, version: finished.version }));
  await expect(asUser(owner, () => actOnGame({ action: "rematch-accept", id: requested.id, version: requested.version }))).rejects.toThrow();
  await expect(asUser(outsider, () => actOnGame({ action: "rematch-accept", id: requested.id, version: requested.version }))).rejects.toThrow();
  const both = await Promise.all([0,1].map(() => asUser(partner, () => actOnGame({ action: "rematch-accept", id: requested.id, version: requested.version }))));
  expect(both[0].rematchGameId).toBeTruthy(); expect(both[1].rematchGameId).toBe(both[0].rematchGameId);
  const next = await asUser(owner, () => getGame(both[0].rematchGameId!));
  expect(next).toMatchObject({ status: "ACTIVE", playerOneId: partner, playerTwoId: owner });
  expect(await prisma.gameMatch.count({ where: { coupleId: couple } })).toBe(2);
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(count);
  expect((await asUser(owner, () => togetherSnapshot())).scores).toEqual(expect.arrayContaining([expect.objectContaining({ userId: partner, wins: 1 })]));
});
it("supports declining, cancelling and expiring a rematch without resetting a finished board", async () => {
  const active = await activeGame();
  let game = await asUser(owner, () => actOnGame({ action: "resign", id: active.id, version: active.version }));
  const board = game.state;
  const action = (actor: string, action: string) => asUser(actor, () => actOnGame({ action, id: game.id, version: game.version }));
  game = await action(owner, "rematch-request");
  await expect(action(partner, "rematch-cancel")).rejects.toThrow();
  game = await action(partner, "rematch-decline"); expect(game.rematchRequestedById).toBeNull();
  game = await action(owner, "rematch-request"); game = await action(owner, "rematch-cancel");
  game = await action(partner, "rematch-request");
  await prisma.gameMatch.update({ where: { id: game.id }, data: { rematchRequestedAt: new Date(Date.now() - 6 * 60_000) } });
  await expect(action(owner, "rematch-accept")).rejects.toThrow();
  expect((await asUser(owner, () => getGame(game.id))).state).toEqual(board);
  expect(await prisma.gameMatch.count({ where: { coupleId: couple } })).toBe(1);
});
it("keeps negotiation private, accepts no chat text, isolates couples and clears metadata on finish", async () => {
  const game = await activeGame(), sessionId = randomUUID(), targetSessionId = randomUUID();
  const hello = { gameId: game.id, sessionId, signal: { kind: "hello", payload: {} } };
  await expect(asUser(outsider, () => sendGameChatSignal(hello))).rejects.toThrow();
  await expect(asUser(owner, () => sendGameChatSignal({ ...hello, signal: { kind: "message", payload: { text: "never store me" } } }))).rejects.toThrow();
  await expect(asUser(owner, () => sendGameChatSignal({ ...hello, signal: { kind: "hello", payload: { text: "never store me" } } }))).rejects.toThrow();
  await asUser(owner, () => sendGameChatSignal(hello));
  await asUser(owner, () => sendGameChatSignal({ ...hello, targetSessionId, signal: { kind: "offer", payload: { type: "offer", sdp: "v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n" } } }));
  expect((await asUser(owner, () => gameChatSignals(game.id, BigInt(0)))).signals).toHaveLength(0);
  expect((await asUser(partner, () => gameChatSignals(game.id, BigInt(0)))).signals).toHaveLength(2);
  await expect(asUser(outsider, () => gameChatSignals(game.id, BigInt(0)))).rejects.toThrow();
  const raw = await prisma.$queryRaw<{ payload: unknown }[]>`SELECT payload FROM game_chat_signals WHERE "gameId" = ${game.id}`;
  expect(JSON.stringify(raw)).not.toContain("webrtc-datachannel");
  await asUser(owner, () => actOnGame({ action: "resign", id: game.id, version: game.version }));
  expect(await prisma.gameChatSignal.count({ where: { gameId: game.id } })).toBe(0);
  await expect(asUser(partner, () => sendGameChatSignal(hello))).rejects.toThrow();
  expect((await asUser(partner, () => gameChatSignals(game.id, BigInt(0)))).active).toBe(false);
});
it("allows documents and custom stickers past 25 MB and exposes only storage totals to admins", async () => {
  const bytes = Buffer.alloc(32, 17), iv = "AA".repeat(8);
  await prisma.chatMessage.create({ data: { coupleId: couple, senderId: owner, clientNonce: randomUUID(), kind: "IMAGE", image: { create: { coupleId: couple, byteLength: 30 * 1024 * 1024, bytes, contentType: "image/png", width: 1, height: 1 } } } });
  const input = { keyId, iv, data: bytes.toString("base64"), body: JSON.stringify({ v: 1, keyId, iv, data: bytes.toString("base64") }), clientNonce: randomUUID() };
  await asUser(owner, () => sendEncryptedDocument(input));
  await asUser(partner, () => sendEncryptedSticker({ ...input, clientNonce: randomUUID(), width: 1, height: 1 }));
  await expect(asUser(owner, () => getAdminDashboard())).rejects.toThrow();
  await prisma.adminAccess.create({ data: { userId: owner } });
  const dashboard = await asUser(owner, () => getAdminDashboard());
  expect(dashboard.storage.attachmentBytes).toBeGreaterThan(30 * 1024 * 1024);
  expect(dashboard.storage.databaseBytes).toBeGreaterThan(0);
  expect(JSON.stringify(dashboard.accounts)).not.toContain("@example.invalid");
});
