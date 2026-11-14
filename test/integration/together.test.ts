import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"); const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { sendChatMessage, togetherSnapshot, actOnGame, getGame, updateChatPresence } from "@/server/services/together-service";
import { actOnCall, getCall, togetherStatus } from "@/server/services/couple-call-service";
import { GET as imageGET } from "@/app/api/together/images/[id]/route";
import { GAME_LABEL, type GameKind, type GameMove } from "@/lib/together/games";
import { legalArcadeMoves } from "@/lib/together/arcade-view";
import { CHAT_IMAGE_SPACE } from "@/lib/together/catalog";
import { sendEncryptedImage, registerChatKey } from "@/server/services/chat-security-service";
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
const text = (body = "Hello ❤️") => ({ kind: "TEXT", body: JSON.stringify({ v: 1, keyId, iv: "AA".repeat(8), data: Buffer.from(body + "-ciphertext-fixture-padding").toString("base64") }), clientNonce: randomUUID() });

it("stores exactly one message across concurrent retries and rejects forged ownership", async () => {
  const input = { ...text(), coupleId: otherCouple, senderId: outsider };
  const sent = await Promise.all([asUser(owner, () => sendChatMessage(input)), asUser(owner, () => sendChatMessage(input))]);
  expect(sent[0].id).toBe(sent[1].id);
  expect(sent[0].senderId).toBe(owner);
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(1);
  expect((await asUser(partner, () => togetherSnapshot())).messages[0].body).toBe(input.body);
  expect((await asUser(outsider, () => togetherSnapshot())).messages).toEqual([]);
  await expect(asUser(owner, () => sendChatMessage({ ...text(), kind: "STICKER", body: "forged" }))).rejects.toThrow();
});
it("provides bounded message pages without losing catch-up messages at the same revision", async () => {
  await prisma.chatMessage.createMany({ data: Array.from({ length: 75 }, (_, n) => ({ coupleId: couple, senderId: owner, clientNonce: `seed-${n}`, kind: "TEXT" as const, body: `Message ${n}` })) });
  await prisma.couple.update({ where: { id: couple }, data: { togetherRevision: { increment: 1 } } });
  const first = await asUser(partner, () => togetherSnapshot({ after: BigInt(0) }));
  expect(first.messages).toHaveLength(60);
  const next = await asUser(partner, () => togetherSnapshot({ after: BigInt(first.cursor), revision: first.revision }));
  expect(next.messages).toHaveLength(15); expect(next.games).toBeUndefined();
  const latest = await asUser(partner, () => togetherSnapshot()); expect(latest.messages).toHaveLength(60);
  const earlier = await asUser(partner, () => togetherSnapshot({ before: BigInt(latest.messages[0].sequence) }));
  expect(earlier.messages).toHaveLength(15);
  expect(new Set([...first.messages, ...next.messages].map((message) => message.id)).size).toBe(75);
});
it("tracks monotonic, bounded read receipts and typing while keeping unread counts private", async () => {
  const sent = await asUser(owner, () => sendChatMessage(text()));
  expect((await asUser(partner, () => togetherStatus())).unread).toBe(1);
  await asUser(partner, () => updateChatPresence({ sequence: sent.sequence, typing: true }));
  expect((await asUser(partner, () => togetherStatus())).unread).toBe(0);
  await asUser(partner, () => updateChatPresence({ sequence: "0", typing: true }));
  const snapshot = await asUser(owner, () => togetherSnapshot());
  expect(snapshot.partner.lastRead).toBe(sent.sequence); expect(new Date(snapshot.partner.typingUntil!).getTime()).toBeGreaterThan(Date.now());
  await asUser(partner, () => updateChatPresence({ sequence: "999999999999999", typing: false }));
  const read = await prisma.chatMemberState.findUniqueOrThrow({ where: { coupleId_userId: { coupleId: couple, userId: partner } } });
  expect(String(read.lastRead)).toBe(sent.sequence);
});
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64");
const image = { keyId, iv: "AA".repeat(8), data: png.toString("base64"), width: 1, height: 1, viewLimit: 0 };
it("persists private images, deduplicates retries, excludes bytes from polling and rechecks access", async () => {
  const nonce = randomUUID();
  const sent = await asUser(owner, () => sendEncryptedImage({ ...image, clientNonce: nonce }));
  expect((await asUser(owner, () => sendEncryptedImage({ ...image, clientNonce: nonce }))).id).toBe(sent.id);
  expect(await prisma.chatImage.count({ where: { coupleId: couple } })).toBe(1);
  const snapshot = await asUser(partner, () => togetherSnapshot());
  expect(snapshot.messages[0].image).toMatchObject({ url: `/api/together/images/${sent.id}`, width: 1, height: 1, encrypted: true });
  expect(JSON.stringify(snapshot)).not.toContain(png.toString("base64"));
  const load = () => imageGET(new Request(`http://localhost/api/together/images/${sent.id}`), { params: Promise.resolve({ id: sent.id }) });
  const allowed = await asUser(partner, load); expect(allowed.status).toBe(200); expect((await allowed.json()).data).toBe(png.toString("base64"));
  expect(allowed.headers.get("cache-control")).toBe("private, no-store");
  expect((await asUser(outsider, load)).status).toBe(404);
  await prisma.coupleMember.updateMany({ where: { userId: partner }, data: { status: "LEFT" } });
  expect((await asUser(partner, load)).status).not.toBe(200);
});
it("rejects an image once the shared quota is full without leaving a partial message", async () => {
  // Simulate the existing usage total without allocating a full quota of image buffers.
  await prisma.chatMessage.create({ data: { coupleId: couple, senderId: owner, clientNonce: randomUUID(), kind: "IMAGE", image: { create: { coupleId: couple, byteLength: CHAT_IMAGE_SPACE, bytes: new Uint8Array(png), contentType: "image/png", width: 1, height: 1 } } } });
  await expect(asUser(owner, () => sendEncryptedImage({ ...image, clientNonce: randomUUID() }))).rejects.toThrow(/full/);
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(1);
});
it.each(Object.keys(GAME_LABEL) as GameKind[])("persists and plays a real shared %s match", async (kind) => {
  const invitation = await asUser(owner, () => actOnGame({ action: "create", kind, clientNonce: randomUUID() }));
  expect(invitation.status).toBe("WAITING");
  await expect(asUser(owner, () => actOnGame({ action: "accept", id: invitation.id, version: 0 }))).rejects.toThrow();
  const active = await asUser(partner, () => actOnGame({ action: "accept", id: invitation.id, version: 0 }));
  let move: GameMove = { type: "place", cell: 0 };
  if (active.state.type === "LUDO") move = { type: "roll" };
  else if (active.state.type === "ARCADE") move = legalArcadeMoves(active.state, 0)[0];
  const updated = await asUser(owner, () => actOnGame({ action: "move", id: active.id, version: active.version, move }));
  expect(updated.version).toBe(2);
  expect((await asUser(partner, () => getGame(active.id))).version).toBe(2);
  await expect(asUser(outsider, () => getGame(active.id))).rejects.toThrow();
  await expect(asUser(owner, () => actOnGame({ action: "move", id: active.id, version: active.version, move }))).rejects.toThrow(/moved on/);
  expect((await asUser(partner, () => togetherSnapshot())).messages.some((message) => message.gameId === active.id)).toBe(true);
});
it("counts a finished result once, even when the winning move is retried or a score is forged", async () => {
  let game = await asUser(owner, () => actOnGame({ action: "create", kind: "TIC_TAC_TOE", clientNonce: randomUUID() }));
  game = await asUser(partner, () => actOnGame({ action: "accept", id: game.id, version: game.version }));
  for (const [actor, cell] of [[owner,0],[partner,3],[owner,1],[partner,4]] as const) game = await asUser(actor, () => actOnGame({ action: "move", id: game.id, version: game.version, move: { type: "place", cell } }));
  const win = { action: "move", id: game.id, version: game.version, move: { type: "place", cell: 2 }, winnerId: partner, score: 999 };
  const results = await Promise.allSettled([asUser(owner, () => actOnGame(win)), asUser(owner, () => actOnGame(win))]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const finished = await asUser(partner, () => getGame(game.id)); expect(finished.status).toBe("FINISHED"); expect(finished.winnerId).toBe(owner);
  await expect(asUser(partner, () => actOnGame({ action: "resign", id: game.id, version: finished.version }))).rejects.toThrow(/Finished/);
  const scores = (await asUser(owner, () => togetherSnapshot())).scores!;
  expect(scores.find((score) => score.userId === owner)).toMatchObject({ wins: 1, losses: 0, draws: 0 });
  expect(scores.find((score) => score.userId === partner)).toMatchObject({ wins: 0, losses: 1, draws: 0 });
  expect(await prisma.chatMessage.count({ where: { clientNonce: `game-result:${game.id}` } })).toBe(1);
  const events = await prisma.chatMessage.findMany({ where: { coupleId: couple, kind: "GAME" } });
  expect(events.every((event) => event.body === "")).toBe(true);
});
it("redacts actual stored game secrets and allows either partner to commit a private RPS choice", async () => {
  for (const kind of ["BATTLESHIP", "MEMORY", "HIGHER_LOWER", "ROCK_PAPER_SCISSORS"] as const) {
    const game = await asUser(owner, () => actOnGame({ action: "create", kind, clientNonce: randomUUID() }));
    const guest = await asUser(partner, () => getGame(game.id));
    if (guest.state.type !== "ARCADE") throw new Error();
    if (kind === "BATTLESHIP") expect(guest.state.data.fleet0).toBeUndefined();
    if (kind === "MEMORY") expect(guest.state.data.deck).toEqual(Array(16).fill(-1));
    if (kind === "HIGHER_LOWER") expect(guest.state.data.secret).toBeUndefined();
    if (kind === "ROCK_PAPER_SCISSORS") {
      const active = await asUser(partner, () => actOnGame({ action: "accept", id: game.id, version: game.version }));
      const chosen = await asUser(partner, () => actOnGame({ action: "move", id: game.id, version: active.version, move: { type: "choose", value: "paper" } }));
      const view = await asUser(owner, () => getGame(chosen.id));
      expect(view.state.type === "ARCADE" && view.state.data.pick1).toBe("hidden");
    }
  }
});
it("enforces a single call and keeps signaling scoped to the two participants", async () => {
  const requests = await Promise.allSettled([asUser(owner, () => actOnCall({ action: "start", kind: "AUDIO", clientNonce: randomUUID() })), asUser(partner, () => actOnCall({ action: "start", kind: "VIDEO", clientNonce: randomUUID() }))]);
  const won = requests.find((result) => result.status === "fulfilled"); if (won?.status !== "fulfilled") throw new Error();
  expect(requests.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const call = won.value;
  await expect(asUser(outsider, () => getCall(call.id))).rejects.toThrow();
  await expect(asUser(call.callerId, () => actOnCall({ action: "accept", id: call.id }))).rejects.toThrow();
  const offer = { kind: "offer", payload: { type: "offer", sdp: "v=0\r\n" } };
  await asUser(call.callerId, () => actOnCall({ action: "signal", id: call.id, signal: offer }));
  expect((await asUser(call.callerId, () => getCall(call.id))).signals).toEqual([]);
  expect((await asUser(call.calleeId, () => getCall(call.id))).signals[0].kind).toBe("offer");
  await asUser(call.calleeId, () => actOnCall({ action: "accept", id: call.id }));
  await expect(asUser(call.calleeId, () => actOnCall({ action: "signal", id: call.id, signal: offer }))).rejects.toThrow();
  await asUser(call.calleeId, () => actOnCall({ action: "signal", id: call.id, signal: { kind: "answer", payload: { type: "answer", sdp: "v=0\r\n" } } }));
  expect((await asUser(call.callerId, () => getCall(call.id))).signals[0].kind).toBe("answer");
  await asUser(call.callerId, () => actOnCall({ action: "end", id: call.id }));
  expect(await prisma.callSignal.count({ where: { callId: call.id } })).toBe(0);
  await expect(asUser(call.calleeId, () => actOnCall({ action: "signal", id: call.id, signal: offer }))).rejects.toThrow();
});
it("creates one recipient notification for retried call starts and no push without opt-in", async () => {
  const input = { action: "start", kind: "AUDIO", clientNonce: randomUUID() };
  const first = await asUser(owner, () => actOnCall(input));
  const again = await asUser(owner, () => actOnCall(input));
  expect(again.id).toBe(first.id);
  const notes = await prisma.notification.findMany({ where: { entityType: "CoupleCall", entityId: first.id } });
  expect(notes).toHaveLength(1); expect(notes[0].userId).toBe(partner); expect(notes[0].coupleId).toBe(couple);
  expect(await prisma.notificationDelivery.count({ where: { notificationId: notes[0].id } })).toBe(0);
});
it("expires unanswered calls and clears their signals before starting another", async () => {
  const call = await asUser(owner, () => actOnCall({ action: "start", kind: "VIDEO", clientNonce: randomUUID() }));
  await asUser(owner, () => actOnCall({ action: "signal", id: call.id, signal: { kind: "offer", payload: { type: "offer", sdp: "v=0\r\n" } } }));
  await prisma.coupleCall.update({ where: { id: call.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
  expect((await asUser(partner, () => getCall(call.id))).call.status).toBe("MISSED");
  expect((await asUser(partner, () => getCall(call.id))).signals).toEqual([]);
  await asUser(owner, () => actOnCall({ action: "start", kind: "AUDIO", clientNonce: randomUUID() }));
  expect(await prisma.callSignal.count({ where: { callId: call.id } })).toBe(0);
});
it("allows either connected partner to upgrade voice to video without another call or exposing it to outsiders", async () => {
  const call = await asUser(owner, () => actOnCall({ action: "start", kind: "AUDIO", clientNonce: randomUUID() }));
  await expect(asUser(owner, () => actOnCall({ action: "video", id: call.id }))).rejects.toThrow(/answers/);
  await asUser(partner, () => actOnCall({ action: "accept", id: call.id }));
  await expect(asUser(outsider, () => actOnCall({ action: "video", id: call.id }))).rejects.toThrow();
  expect((await asUser(partner, () => actOnCall({ action: "video", id: call.id }))).kind).toBe("VIDEO");
  expect((await asUser(owner, () => actOnCall({ action: "video", id: call.id }))).id).toBe(call.id);
  expect(await prisma.coupleCall.count({ where: { coupleId: couple } })).toBe(1);
  await asUser(owner, () => actOnCall({ action: "end", id: call.id }));
  await expect(asUser(partner, () => actOnCall({ action: "video", id: call.id }))).rejects.toThrow(/ended/);
});
it("refuses chat, games and call writes after a member leaves", async () => {
  await prisma.coupleMember.updateMany({ where: { userId: partner }, data: { status: "LEFT" } });
  await expect(asUser(owner, () => sendChatMessage(text()))).rejects.toThrow();
  await expect(asUser(owner, () => sendEncryptedImage({ ...image, clientNonce: randomUUID() }))).rejects.toThrow();
  await expect(asUser(owner, () => actOnGame({ action: "create", kind: "LUDO", clientNonce: randomUUID() }))).rejects.toThrow();
  await expect(asUser(owner, () => actOnCall({ action: "start", kind: "AUDIO", clientNonce: randomUUID() }))).rejects.toThrow();
  expect(await prisma.chatMessage.count({ where: { coupleId: couple } })).toBe(0);
});
