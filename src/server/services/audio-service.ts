import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/admin";
import { lockVerifiedUser } from "@/lib/authz/user-write";
import { ValidationError } from "@/lib/errors";
import { AUDIO_LIMIT, audioType } from "@/lib/audio/file";

const changeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preferences"), musicVolume: z.number().min(0).max(1), musicEnabled: z.boolean() }),
  z.object({ action: z.literal("ringtone"), name: z.string().trim().min(1).max(180), data: z.string().min(24).max(2800000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }),
  z.object({ action: z.literal("music"), name: z.string().trim().min(1).max(180), data: z.string().min(24).max(2800000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }),
  z.object({ action: z.literal("remove-ringtone") }),
  z.object({ action: z.literal("remove-music") }),
]);
export async function getAudioSettings() {
  const user = await requireUser();
  const [own, music] = await Promise.all([
    prisma.userAudio.findUnique({ where: { userId: user.id }, select: { filename: true, updatedAt: true, musicVolume: true, musicEnabled: true } }),
    prisma.siteAudio.findUnique({ where: { id: "background" }, select: { title: true, updatedAt: true } }),
  ]);
  return { ringtoneName: own?.filename ?? null, ringtoneVersion: own?.filename ? own.updatedAt.toISOString() : null,
    musicVolume: own?.musicVolume ?? 0.2, musicEnabled: own?.musicEnabled ?? false,
    music: music ? { title: music.title, version: music.updatedAt.toISOString() } : null };
}
export async function changeAudio(input: unknown) {
  const user = await requireUser(), value = changeSchema.parse(input);
  const global = value.action === "music" || value.action === "remove-music";
  if (global) await requireAdmin();
  let bytes: Buffer | undefined, contentType: string | undefined;
  if (value.action === "ringtone" || value.action === "music") {
    bytes = Buffer.from(value.data, "base64"); contentType = audioType(bytes) ?? undefined;
    if (!bytes.length || bytes.length > AUDIO_LIMIT || !contentType) throw new ValidationError("Choose an MP3, M4A, WAV or Ogg audio file up to 2 MB.");
  }
  await prisma.$transaction(async (tx) => {
    if (global) await requireAdmin(tx); else await lockVerifiedUser(tx, user.id);
    if (value.action === "preferences") {
      const data = { musicVolume: value.musicVolume, musicEnabled: value.musicEnabled };
      await tx.userAudio.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    } else if (value.action === "ringtone" || value.action === "remove-ringtone") {
      const data = value.action === "ringtone" ? { ringtone: new Uint8Array(bytes!), contentType: contentType!, filename: value.name } : { ringtone: null, contentType: null, filename: null };
      await tx.userAudio.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    } else {
      if (value.action === "remove-music") await tx.siteAudio.deleteMany({ where: { id: "background" } });
      else {
        const data = { bytes: new Uint8Array(bytes!), contentType: contentType!, title: value.name, updatedById: user.id };
        await tx.siteAudio.upsert({ where: { id: "background" }, create: { id: "background", ...data }, update: data });
      }
      await tx.moderationAudit.create({ data: { actorId: user.id, targetId: "background", action: "SITE_AUDIO_CHANGED", reason: value.action === "remove-music" ? "Removed background music" : "Changed background music" } });
    }
  });
  return getAudioSettings();
}
export async function readAudio(kind: "music" | "ringtone") {
  const user = await requireUser();
  if (kind === "music") return prisma.siteAudio.findUnique({ where: { id: "background" }, select: { bytes: true, contentType: true } });
  const own = await prisma.userAudio.findUnique({ where: { userId: user.id }, select: { ringtone: true, contentType: true } });
  return own?.ringtone && own.contentType ? { bytes: own.ringtone, contentType: own.contentType } : null;
}
