import { expect, it } from "vitest";
import { mergeMessages } from "./use-together";
import type { MessageDTO } from "../together/types";
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
