import { describe, expect, it } from "vitest";
import { videoMetadata } from "./video-transfer";
import { VIDEO_CHUNK_BYTES } from "./video-policy";
const metadata = { v: 1, name: "our day.webm", type: "video/webm", size: VIDEO_CHUNK_BYTES + 1, chunkCount: 2 };
describe("encrypted video metadata", () => {
  it("does not offer executable download filenames from a modified sender", () => {
    expect(videoMetadata(JSON.stringify({ ...metadata, name: "../surprise.html" }))?.name).toBe(".._surprise.html.video");
    expect(videoMetadata(JSON.stringify(metadata))?.name).toBe("our day.webm");
  });
  it("rejects active-content types and a chunk count inconsistent with the authenticated metadata", () => {
    expect(videoMetadata(JSON.stringify({ ...metadata, type: "text/html" }))).toBeNull();
    expect(videoMetadata(JSON.stringify({ ...metadata, chunkCount: 1 }))).toBeNull();
  });
});
