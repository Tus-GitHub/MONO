import { z } from "zod";
import { ARCHIVE_MAX_BYTES, ARCHIVE_MAX_ROWS } from "@/lib/archive/limits";

const previewSchema = z.object({
  format: z.literal("mono.archive.v1"),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  exportedAt: z.string().datetime(),
  exporterEmail: z.string().email(),
  couple: z.object({ name: z.string().nullable() }),
  members: z.array(z.object({ email: z.string().email(), role: z.enum(["OWNER", "PARTNER"]) })).min(1).max(2),
  dates: z.array(z.unknown()).max(ARCHIVE_MAX_ROWS), photos: z.array(z.unknown()).max(ARCHIVE_MAX_ROWS),
  memories: z.array(z.unknown()).max(ARCHIVE_MAX_ROWS), expenses: z.array(z.unknown()).max(ARCHIVE_MAX_ROWS),
});

/** Preview only. The server independently checks every field, reference, digest and permission. */
export function readArchivePreview(text: string) {
  if (new TextEncoder().encode(text).byteLength > ARCHIVE_MAX_BYTES) {
    throw new Error("Choose an archive smaller than 64 MiB.");
  }
  let archive: unknown;
  try { archive = JSON.parse(text); }
  catch { throw new Error("This file isn't readable JSON. Choose a MONO portable archive."); }
  const parsed = previewSchema.safeParse(archive);
  if (!parsed.success) throw new Error("Choose a MONO portable archive from Archive & restore. The regular data export cannot be restored.");
  const data = parsed.data;
  return {
    archive,
    summary: {
      name: data.couple.name, exportedAt: data.exportedAt, exporterEmail: data.exporterEmail,
      members: data.members, digest: data.digest,
      dates: data.dates.length, photos: data.photos.length,
      memories: data.memories.length, expenses: data.expenses.length,
    },
  };
}

export type ArchiveSelection = ReturnType<typeof readArchivePreview>;
