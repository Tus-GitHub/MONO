import { expect, it } from "vitest";
import { isCanonicalStorageKey } from "./key";

it.each(["", "/couples/mine/photo.webp", "couples/mine/../other/photo.webp", "couples/mine/./photo.webp", "users/mine//photo.webp", "users/mine/a\\b.webp", "users/mine/a\n.webp", "other/mine/photo.webp"])("rejects invalid key %j", (key) => {
  expect(isCanonicalStorageKey(key)).toBe(false);
});
it.each(["users/user_1/avatar/image.webp", "couples/couple-1/dates/date_1/photos/image.thumb.webp"])("accepts canonical owner-scoped key %s", (key) => {
  expect(isCanonicalStorageKey(key)).toBe(true);
});
