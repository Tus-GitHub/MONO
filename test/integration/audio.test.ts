import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma"), { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { changeAudio, getAudioSettings, readAudio } from "@/server/services/audio-service";
let owner: string, other: string;
const data = Buffer.from("ID3" + "fixture audio".repeat(6)).toString("base64");
beforeEach(async () => {
  const run = randomUUID();
  const users = await Promise.all(["a", "b"].map((role) => prisma.user.create({ data: { name: `${role}-${run}`, email: `${role}-${run}@example.invalid`, emailVerified: new Date() } })));
  owner = users[0].id; other = users[1].id;
});
afterEach(async () => {
  await prisma.siteAudio.deleteMany({ where: { updatedById: owner } });
  await prisma.moderationAudit.deleteMany({ where: { actorId: { in: [owner, other] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
});
afterAll(() => prisma.$disconnect());
it("defaults to 20%, keeps personal ringtones private, and persists independent volume/mute", async () => {
  expect(await asUser(owner, getAudioSettings)).toMatchObject({ musicVolume: 0.2, musicEnabled: false, ringtoneName: null });
  await asUser(owner, () => changeAudio({ action: "ringtone", name: "my tone.mp3", data }));
  const [raw] = await prisma.$queryRaw<{ filename: string; ringtone: Uint8Array }[]>`SELECT filename, ringtone FROM user_audio WHERE "userId" = ${owner}`;
  expect(raw.filename).not.toContain("my tone.mp3"); expect(Buffer.from(raw.ringtone).toString()).not.toContain("fixture audio");
  expect((await asUser(owner, () => readAudio("ringtone")))?.contentType).toBe("audio/mpeg");
  expect(await asUser(other, () => readAudio("ringtone"))).toBeNull();
  await asUser(owner, () => changeAudio({ action: "preferences", musicVolume: 0, musicEnabled: true }));
  expect(await asUser(owner, getAudioSettings)).toMatchObject({ musicVolume: 0, musicEnabled: true, ringtoneName: "my tone.mp3" });
  expect(await asUser(other, getAudioSettings)).toMatchObject({ musicVolume: 0.2, musicEnabled: false });
  await expect(asUser(owner, () => changeAudio({ action: "preferences", musicVolume: 1.5, musicEnabled: true }))).rejects.toThrow();
});
it("only an active verified admin can publish music and every account can read it", async () => {
  await expect(asUser(owner, () => changeAudio({ action: "music", name: "song.mp3", data }))).rejects.toThrow();
  await prisma.adminAccess.create({ data: { userId: owner } });
  await asUser(owner, () => changeAudio({ action: "music", name: "song.mp3", data }));
  expect((await asUser(other, getAudioSettings)).music?.title).toBe("song.mp3");
  expect((await asUser(other, () => readAudio("music")))?.contentType).toBe("audio/mpeg");
  await prisma.user.update({ where: { id: owner }, data: { blockedAt: new Date() } });
  await expect(asUser(owner, () => changeAudio({ action: "remove-music" }))).rejects.toThrow();
});
it("rejects non-audio bytes and unverified personal uploads", async () => {
  await expect(asUser(owner, () => changeAudio({ action: "ringtone", name: "fake.mp3", data: Buffer.from("<html>arbitrary data</html>").toString("base64") }))).rejects.toThrow();
  await prisma.user.update({ where: { id: owner }, data: { emailVerified: null } });
  await expect(asUser(owner, () => changeAudio({ action: "ringtone", name: "tone.mp3", data }))).rejects.toThrow();
});
