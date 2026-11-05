import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/photo-service", () => ({ getBestPhotoWallPage: mocks.page }));
import { loadMoreBestPhotosAction } from "./photos";

beforeEach(() => vi.resetAllMocks());

it("passes a compound timestamp/ID cursor through the action instead of truncating the wall", async () => {
  const cursor = Buffer.from(JSON.stringify({ at: "2026-11-05T10:15:00.000Z", id: "cmw1fixturephotowall0000001" })).toString("base64url");
  expect(cursor.length).toBeGreaterThan(40);
  const result = { photos: [{ id: "older-photo" }], nextCursor: null };
  mocks.page.mockResolvedValue(result);
  expect(await loadMoreBestPhotosAction(cursor)).toEqual(result);
  expect(mocks.page).toHaveBeenCalledWith(cursor);
});

it.each(["x".repeat(257), undefined, { cursor: "untrusted" }])("rejects oversized or non-string cursor input before querying: %j", async (cursor) => {
  expect(await loadMoreBestPhotosAction(cursor as string)).toEqual({ photos: [], nextCursor: null });
  expect(mocks.page).not.toHaveBeenCalled();
});
