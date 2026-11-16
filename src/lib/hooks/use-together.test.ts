import { expect, it } from "vitest";
import { mergeMessages, mergeTogetherSnapshot } from "./use-together";
import type { MessageDTO, TogetherSnapshot } from "../together/types";
const message: MessageDTO = { id: "one", sequence: "9007199254740995", senderId: "alice", clientNonce: "nonce", kind: "TEXT", body: "ciphertext", encrypted: true, version: 0, editedAt: null, deleted: false, hidden: false, image: null, gameId: null, createdAt: "2026-11-15T00:00:00Z" };
it("does not resurrect a deleted or hidden message from a slow poll or an older history page", () => {
  const deleted = { ...message, body: "", deleted: true, version: 2 };
  expect(mergeMessages([deleted], [message])[0]).toEqual(deleted);
  const hidden = { ...message, body: "", hidden: true, version: 3 };
  expect(mergeMessages([hidden], [deleted])[0]).toEqual(hidden);
});
it("merges edits and new messages without losing bigint order", () => {
  const edited = { ...message, body: "new ciphertext", version: 1 };
  const older = { ...message, id: "old", sequence: "9007199254740994" };
  expect(mergeMessages([message], [edited, older])).toEqual([older, edited]);
});
const snapshot: TogetherSnapshot = { coupleId: "couple", chatKeyId: "old-key", revision: "1", cursor: message.sequence, messages: [message], hasMore: true, timezone: "Asia/Kolkata", observedAt: message.createdAt,
  partner: { id: "bob", name: "Bob", avatarUrl: null, lastRead: "0", lastSeenAt: null, typingUntil: null }, games: [], soloScores: [{ kind: "EMOJI_BOUNCE", userId: "alice", bestScore: 90 }] };
it("clears old chat on reset while preserving games and high scores", () => {
  const fresh = { ...message, id: "fresh", generation: 1, sequence: "9007199254740996" };
  const result = mergeTogetherSnapshot(snapshot, { ...snapshot, chatGeneration: 1, chatKeyId: "new-key", messages: [fresh], updates: [message], games: undefined, soloScores: undefined, hasMore: false });
  expect(result.messages).toEqual([fresh]);
  expect(result.soloScores).toEqual(snapshot.soloScores);
  expect(result.games).toEqual([]);
  expect(result.chatKeyId).toBe("new-key");
  expect(result.hasMore).toBe(false);
});
it("ignores an older generation from an out-of-order response", () => {
  const reset = { ...snapshot, chatGeneration: 2, messages: [], chatKeyId: "new-key" };
  expect(mergeTogetherSnapshot(reset, snapshot)).toBe(reset);
});
