import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/admin";
import { AUDIO_CHUNK_BYTES, MUSIC_LIMIT, audioType } from "@/lib/audio/file";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { getAudioSettings } from "./audio-service";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), name: z.string().trim().min(1).max(180), size: z.number().int().min(16).max(MUSIC_LIMIT) }),
  z.object({ action: z.literal("part"), id: z.string().cuid(), index: z.number().int().min(0).max(9), data: z.string().min(4).max(1_400_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }),
  z.object({ action: z.literal("finish"), id: z.string().cuid() }),
  z.object({ action: z.literal("cancel"), id: z.string().cuid() }),
]);

/** Each HTTP request stays small; encrypted staging is bounded to one upload per admin. */
export async function uploadAdminMusic(value: unknown) {
  const input = schema.parse(value), admin = await requireAdmin();
  const result = await prisma.$transaction(async (tx) => {
    await requireAdmin(tx);
    await tx.audioUpload.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    if (input.action === "start") {
      await tx.audioUpload.deleteMany({ where: { userId: admin.id } });
      const upload = await tx.audioUpload.create({ data: { userId: admin.id, name: input.name, totalBytes: input.size, bytes: new Uint8Array(), expiresAt: new Date(Date.now() + 30 * 60_000) } });
      return { id: upload.id, nextPart: 0 };
    }
    const upload = await tx.audioUpload.findFirst({ where: { id: input.id, userId: admin.id } });
    if (!upload) throw new NotFoundError("This upload expired. Choose the song again.");
    if (input.action === "cancel") { await tx.audioUpload.delete({ where: { id: upload.id } }); return { cancelled: true }; }
    if (input.action === "part") {
      const bytes = Buffer.from(input.data, "base64"), digest = createHash("sha256").update(bytes).digest("hex");
      if (input.index === upload.nextPart - 1 && digest === upload.lastDigest) return { nextPart: upload.nextPart };
      if (upload.published || input.index !== upload.nextPart) throw new ConflictError("This upload changed. Choose the song again.");
      const remaining = upload.totalBytes - upload.bytes.length;
      if (bytes.length !== Math.min(AUDIO_CHUNK_BYTES, remaining) || !bytes.length || bytes.toString("base64") !== input.data) throw new ValidationError("That audio chunk is incomplete.");
      await tx.audioUpload.update({ where: { id: upload.id }, data: { bytes: Buffer.concat([upload.bytes, bytes]), nextPart: { increment: 1 }, lastDigest: digest } });
      return { nextPart: upload.nextPart + 1 };
    }
    if (!upload.published) {
      const contentType = audioType(upload.bytes);
      if (upload.bytes.length !== upload.totalBytes || !contentType) throw new ValidationError("Upload a complete MP3, M4A, WAV or Ogg file up to 10 MB.");
      const data = { bytes: upload.bytes, contentType, title: upload.name, updatedById: admin.id };
      await tx.siteAudio.create({ data: { id: upload.id, ...data } });
      await tx.moderationAudit.create({ data: { actorId: admin.id, targetId: upload.id, action: "SITE_AUDIO_CHANGED", reason: "Added a background song" } });
      await tx.audioUpload.update({ where: { id: upload.id }, data: { published: true, bytes: new Uint8Array() } });
    }
    return { published: true };
  }, { timeout: 20_000 });
  return input.action === "finish" ? getAudioSettings() : result;
}
