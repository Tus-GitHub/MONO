// Per-request chunks keep uploads below the hosting request limit. No couple quota.
export const VIDEO_CHUNK_BYTES = 1024 * 1024;
export const VIDEO_MAX_BYTES = 512 * 1024 * 1024;
export const videoChunkCount = (bytes: number) => Math.ceil(bytes / VIDEO_CHUNK_BYTES);
export const videoChunkAAD = (index: number, count: number) => `VIDEO_BYTES:${index}:${count}`;
