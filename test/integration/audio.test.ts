import { createHash, randomUUID } from "node:crypto";
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

import { uploadAdminMusic } from "@/server/services/audio-upload-service";
import { AUDIO_CHUNK_BYTES, MUSIC_LIMIT } from "@/lib/audio/file";
import { GET as audioGET } from "@/app/api/audio/route";
import { NextRequest } from "next/server";
it("publishes 10 MB in bounded encrypted chunks, retries safely and streams complete/ranged playback", async () => {
  await prisma.adminAccess.create({ data: { userId: owner } });
  const start = await asUser(owner, () => uploadAdminMusic({ action: "start", name: "ten-megabyte.mp3", size: MUSIC_LIMIT })) as { id: string };
  const bytes = Buffer.alloc(MUSIC_LIMIT, 11); bytes.write("ID3");
  for (let i = 0; i < 10; i++) {
    const part = { action: "part", id: start.id, index: i, data: bytes.subarray(i * AUDIO_CHUNK_BYTES, (i + 1) * AUDIO_CHUNK_BYTES).toString("base64") };
    await asUser(owner, () => uploadAdminMusic(part));
    if (i === 0) {
      expect(await asUser(owner, () => uploadAdminMusic(part))).toMatchObject({ nextPart: 1 });
      await expect(asUser(other, () => uploadAdminMusic(part))).rejects.toThrow();
      const [raw] = await prisma.$queryRaw<{ bytes: Uint8Array; name: string }[]>`SELECT bytes, name FROM audio_uploads WHERE id = ${start.id}`;
      expect(raw.name).not.toContain("ten-megabyte"); expect(Buffer.from(raw.bytes).subarray(0, 3).toString()).not.toBe("ID3");
      await expect(asUser(owner, () => uploadAdminMusic({ action: "finish", id: start.id }))).rejects.toThrow();
    }
  }
  await asUser(owner, () => uploadAdminMusic({ action: "finish", id: start.id }));
  await asUser(owner, () => uploadAdminMusic({ action: "finish", id: start.id }));
  expect(await prisma.moderationAudit.count({ where: { actorId: owner, action: "SITE_AUDIO_CHANGED" } })).toBe(1);
  const response = await asUser(other, () => audioGET(new NextRequest("http://localhost/api/audio?kind=music")));
  expect(response.status).toBe(200); expect(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex")).toBe(createHash("sha256").update(bytes).digest("hex"));
  const range = await asUser(other, () => audioGET(new NextRequest("http://localhost/api/audio?kind=music", { headers: { Range: "bytes=1048570-1048580" } })));
  expect(range.status).toBe(206); expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(1048570, 1048581));
  await asUser(owner, () => uploadAdminMusic({ action: "cancel", id: start.id }));
  expect(await prisma.audioUpload.count({ where: { userId: owner } })).toBe(0);
}, 60_000);
it("rejects oversized and out-of-order audio and never publishes an abandoned upload", async () => {
  await prisma.adminAccess.create({ data: { userId: owner } });
  await expect(asUser(owner, () => uploadAdminMusic({ action: "start", name: "large.mp3", size: MUSIC_LIMIT + 1 }))).rejects.toThrow();
  const start = await asUser(owner, () => uploadAdminMusic({ action: "start", name: "incomplete.mp3", size: 20 })) as { id: string };
  await expect(asUser(owner, () => uploadAdminMusic({ action: "part", id: start.id, index: 1, data }))).rejects.toThrow();
  await asUser(owner, () => uploadAdminMusic({ action: "cancel", id: start.id }));
  expect(await prisma.siteAudio.count({ where: { updatedById: owner } })).toBe(0);
});
