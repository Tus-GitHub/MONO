import { expect, it } from "vitest";
import { encodeDraft, readDraft } from "./draft";

it("restores all values, including deliberately cleared text", () => {
  expect(readDraft(encodeDraft("old", "", 100), "old", 101)).toBe("");
  expect(readDraft(encodeDraft("old", { score: 8, text: "Hello" }, 100), "old", 101)).toEqual({ score: 8, text: "Hello" });
});
it("does not overwrite newer server content with an old draft", () => {
  expect(readDraft(encodeDraft("old", "draft", 100), "new", 101)).toBeUndefined();
});
it("ignores stale, malformed, and legacy entries", () => {
  for (const value of ["broken", "null", JSON.stringify({}), encodeDraft("old", "draft", 100)]) {
    expect(readDraft(value, "old", 100 + 8 * 24 * 60 * 60_000)).toBeUndefined();
  }
});
