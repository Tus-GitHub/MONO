import { describe, expect, it } from "vitest";
import { readArchivePreview } from "./preview";

const file = {
  format: "mono.archive.v1", digest: "a".repeat(64), exportedAt: "2026-11-10T00:00:00.000Z",
  exporterEmail: "owner@example.com", couple: { name: "Our space" },
  members: [{ email: "owner@example.com", role: "OWNER" }],
  dates: [{ id: "date-1", notes: "Keep all fields for server validation" }],
  photos: [], memories: [], expenses: [], extraField: "The server must see and reject unknown data",
};

describe("portable archive preview", () => {
  it("preserves the original payload for authoritative validation rather than stripping fields", () => {
    const preview = readArchivePreview(JSON.stringify(file));
    expect(preview.archive).toEqual(file);
    expect(preview.summary.dates).toBe(1);
    expect(preview.summary.members).toEqual(file.members);
  });
  it("rejects unreadable files and regular data exports with actionable feedback", () => {
    expect(() => readArchivePreview("not JSON")).toThrow("readable JSON");
    expect(() => readArchivePreview(JSON.stringify({ dates: [] }))).toThrow("regular data export");
  });
  it("does not render malformed archive dates, identities or counts", () => {
    for (const patch of [{ exportedAt: "yesterday" }, { members: [] }, { photos: {} }, { digest: "bad" }]) {
      expect(() => readArchivePreview(JSON.stringify({ ...file, ...patch }))).toThrow("MONO portable archive");
    }
  });
});
