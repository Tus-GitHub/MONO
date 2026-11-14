import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  const { AuthenticationError } = await import("@/lib/errors");
  return { requireUser: async () => {
    const id = testUser.getStore();
    const user = id ? await prisma.user.findFirst({ where: { id, deletedAt: null } }) : null;
    if (!user) throw new AuthenticationError();
    return user;
  } };
});

import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { GET as getMedia } from "@/app/media/[...key]/route";
import { saveUserAvatar } from "@/server/services/profile-media-service";
import { coupleRevision } from "@/server/services/couple-sync-service";

const token = randomUUID(), keys = new Set<string>();
let users: string[] = [];
const couples: string[] = [];
beforeAll(async () => {
  users = (await Promise.all([0, 1, 2, 3].map(index => prisma.user.create({ data: {
    name: `Photo access ${token} ${index}`, email: `photo-access-${token}-${index}@example.invalid`,
  } })))).map(user => user.id);
  for (const offset of [0, 2]) couples.push((await prisma.couple.create({ data: {
    createdById: users[offset], inviteCode: `${token}-${offset}`, status: "ACTIVE",
    members: { create: [{ userId: users[offset], role: "OWNER" }, { userId: users[offset + 1], role: "PARTNER" }] },
  } })).id);
});
beforeEach(async () => {
  await prisma.user.updateMany({ where: { id: { in: users } }, data: { deletedAt: null } });
  await prisma.couple.updateMany({ where: { id: { in: couples } }, data: { status: "ACTIVE", deletedAt: null } });
  await prisma.coupleMember.updateMany({ where: { coupleId: { in: couples } }, data: { status: "ACTIVE" } });
});
afterAll(async () => {
  for (const key of keys) await storage.delete(key);
  await prisma.storageCleanup.deleteMany({ where: { OR: users.map(id => ({ key: { startsWith: `users/${id}/` } })) } });
  await prisma.couple.deleteMany({ where: { id: { in: couples } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

async function avatar() {
  const result = await asUser(users[0], () => saveUserAvatar({ filename: "avatar.webp", contentType: "image/webp", bytes: Buffer.from("private cropped avatar") }));
  keys.add(result.key!); return result.key!;
}
const media = (viewer: string, key: string, etag?: string) => asUser(viewer, () => getMedia(
  new NextRequest(`http://localhost/media/${key}`, etag ? { headers: { "if-none-match": etag } } : undefined),
  { params: Promise.resolve({ key: key.split("/") }) },
));
async function revision(id: string) {
  const couple = await prisma.couple.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } });
  return coupleRevision(id, couple.updatedAt);
}

it("shares the current avatar with its owner and active partner, never strangers or other personal files", async () => {
  const key = await avatar();
  const owner = await media(users[0], key), partner = await media(users[1], key);
  expect(owner.status).toBe(200); expect(partner.status).toBe(200);
  expect(await partner.text()).toBe("private cropped avatar");
  expect(partner.headers.get("cache-control")).toBe("private, no-cache");
  expect((await media(users[2], key, owner.headers.get("etag")!)).status).toBe(404);
  expect((await media("", key)).status).toBe(404);
  const privateKey = `users/${users[0]}/private/fixture.webp`; keys.add(privateKey);
  await storage.put({ key: privateKey, body: Buffer.from("personal file"), contentType: "image/webp" });
  // Even an active reference elsewhere must not widen the partner exception beyond avatars.
  await prisma.user.update({ where: { id: users[0] }, data: { avatarKey: privateKey } });
  expect((await media(users[0], privateKey)).status).toBe(200);
  expect((await media(users[1], privateKey)).status).toBe(404);
});

it("rechecks both memberships and couple/account state before serving a cached partner avatar", async () => {
  const key = await avatar(), etag = (await media(users[1], key)).headers.get("etag")!;
  expect((await media(users[1], key, etag)).status).toBe(304);
  for (const userId of users.slice(0, 2)) {
    await prisma.coupleMember.update({ where: { coupleId_userId: { coupleId: couples[0], userId } }, data: { status: "LEFT" } });
    expect((await media(users[1], key, etag)).status).toBe(404);
    await prisma.coupleMember.update({ where: { coupleId_userId: { coupleId: couples[0], userId } }, data: { status: "ACTIVE" } });
  }
  await prisma.couple.update({ where: { id: couples[0] }, data: { status: "ARCHIVED" } });
  expect((await media(users[1], key, etag)).status).toBe(404);
  await prisma.couple.update({ where: { id: couples[0] }, data: { status: "ACTIVE", deletedAt: new Date() } });
  expect((await media(users[1], key, etag)).status).toBe(404);
  await prisma.couple.update({ where: { id: couples[0] }, data: { deletedAt: null } });
  await prisma.user.update({ where: { id: users[0] }, data: { deletedAt: new Date() } });
  expect((await media(users[1], key, etag)).status).toBe(404);
});

it("invalidates replaced avatars for both partners even with a previously valid ETag", async () => {
  const previous = await avatar(), etag = (await media(users[1], previous)).headers.get("etag")!;
  const current = await avatar();
  for (const viewer of users.slice(0, 2)) {
    expect((await media(viewer, previous, etag)).status).toBe(404);
    expect((await media(viewer, current)).status).toBe(200);
  }
});

it("changes the couple's live revision on avatar save/removal without touching another couple", async () => {
  await prisma.couple.update({ where: { id: couples[0] }, data: { updatedAt: new Date("2020-01-01T00:00:00Z") } });
  const before = await revision(couples[0]), unrelated = await revision(couples[1]);
  const key = await avatar();
  expect(await revision(couples[0])).not.toBe(before);
  expect(await revision(couples[1])).toBe(unrelated);
  await prisma.couple.update({ where: { id: couples[0] }, data: { updatedAt: new Date("2020-01-01T00:00:00Z") } });
  const beforeRemoval = await revision(couples[0]);
  await asUser(users[0], () => saveUserAvatar(null));
  expect(await revision(couples[0])).not.toBe(beforeRemoval);
  expect(await revision(couples[1])).toBe(unrelated);
  expect((await media(users[1], key)).status).toBe(404);
});
