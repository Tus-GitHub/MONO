import { Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PRIVATE_FILE_MAGIC, PRIVATE_TEXT_PREFIX, type PrivateCrypto } from "./crypto";
import { identityLookupFields, privateBytesFields, privateJsonFields, privateTextFields } from "./fields";
import { privateDataCodec } from "./prisma-extension";
import type { StorageDriver } from "@/lib/storage/types";
import { croppedUrl, readSavedCrop } from "@/lib/images/saved-crop";

type Row = Record<string, unknown>;
type Delegate = { findMany(args: unknown): Promise<Row[]>; findUnique(args: unknown): Promise<Row | null>; update(args: unknown): Promise<Row> };
const delegate = (db: PrismaClient | Prisma.TransactionClient, name: string) => (db as unknown as Record<string, Delegate>)[name[0].toLowerCase() + name.slice(1)];
// The engineType=client runtime DMMF can omit isId/dbName. Keep these operator-only
// identifiers explicit: none is derived from database contents or user input.
const tables: Record<string, [table: string, pk: string]> = {
  UserAudio: ["user_audio", "userId"], SiteAudio: ["site_audio", "id"],
  User: ["users", "id"], AdminAccess: ["admin_access", "userId"], Account: ["accounts", "id"],
  AuthSession: ["auth_sessions", "id"], EmailVerificationToken: ["email_verification_tokens", "id"],
  CoupleInvitation: ["couple_invitations", "id"], Couple: ["couples", "id"], Place: ["places", "id"],
  Date: ["dates", "id"], DateActivity: ["date_activities", "id"], DatePhoto: ["date_photos", "id"],
  ReviewCategory: ["review_categories", "id"], DateReview: ["date_reviews", "id"], DateReviewRating: ["date_review_ratings", "id"],
  RevisitDecision: ["revisit_decisions", "id"], Expense: ["expenses", "id"], Memory: ["memories", "id"],
  Notification: ["notifications", "id"], DateEvent: ["date_events", "id"], ChatMessage: ["chat_messages", "id"],
  AccountReport: ["account_reports", "id"], ModerationAudit: ["moderation_audit", "id"], EmailBlock: ["email_blocks", "emailHash"],
  GameMatch: ["game_matches", "id"], CallSignal: ["call_signals", "id"], PushSubscription: ["push_subscriptions", "id"],
  NotificationPreference: ["notification_preferences", "userId"], ChatImage: ["chat_images", "messageId"],
};
const encryptedBytes = (value: Uint8Array) => Buffer.from(value).subarray(0, PRIVATE_FILE_MAGIC.length).equals(PRIVATE_FILE_MAGIC);
const jsonEnvelope = (value: unknown): value is { monoPrivate: string } => !!value && typeof value === "object" && "monoPrivate" in value && typeof value.monoPrivate === "string";

/** Explicit operator tool, never an HTTP endpoint. No row contents, addresses or keys in reports. */
export async function migratePrivateFields(raw: PrismaClient, crypto: PrivateCrypto, apply: boolean) {
  const codec = privateDataCodec(() => crypto);
  const report: Record<string, { rows: number; changed: number; plaintextFields: number }> = {};
  const names = new Set([...Object.keys(privateTextFields), ...Object.keys(privateJsonFields), ...Object.keys(privateBytesFields)]);
  for (const name of names) {
    if (!tables[name]) throw new Error("Missing private-data migration model mapping.");
    const [table, pk] = tables[name];
    const stats = report[name] = { rows: 0, changed: 0, plaintextFields: 0 };
    let cursor: unknown;
    for (;;) {
      const rows = await delegate(raw, name).findMany({ orderBy: { [pk]: "asc" }, take: 100,
        ...(cursor === undefined ? {} : { cursor: { [pk]: cursor }, skip: 1 }) });
      for (const snapshot of rows) {
        await raw.$transaction(async (tx) => {
          const id = snapshot[pk];
          await tx.$queryRaw(Prisma.sql`SELECT ${Prisma.raw(`"${pk}"`)} FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${pk}"`)} = ${id} FOR UPDATE`);
          const row = await delegate(tx, name).findUnique({ where: { [pk]: id } });
          if (!row) return;
          stats.rows++;
          const patch: Row = {};
          for (const field of privateTextFields[name] ?? []) {
            const value = row[field];
            if (typeof value !== "string") continue;
            const encrypted = value.startsWith(PRIVATE_TEXT_PREFIX);
            // Authenticate existing ciphertext as part of auditing; wrong keys must never be skipped.
            const plain = encrypted ? crypto.decryptText(value, `${name}.${field}`) : value;
            if (!encrypted && value) stats.plaintextFields++;
            const index = identityLookupFields[name]?.[field];
            if (!encrypted || (index && !row[index])) patch[field] = plain;
          }
          for (const field of privateJsonFields[name] ?? []) {
            const value = row[field];
            if (value == null) continue;
            if (jsonEnvelope(value)) crypto.decryptText(value.monoPrivate, `${name}.${field}`);
            else { stats.plaintextFields++; patch[field] = value; }
          }
          for (const field of privateBytesFields[name] ?? []) {
            const value = row[field];
            if (!(value instanceof Uint8Array)) continue;
            if (encryptedBytes(value)) crypto.open(value.subarray(PRIVATE_FILE_MAGIC.length), `${name}.${field}`);
            else { if (value.length) stats.plaintextFields++; patch[field] = value; }
          }
          if (Object.keys(patch).length && apply) {
            const data = codec.data(name, patch);
            if (name === "User" && patch.email && !row.moderationEmailHash) data.moderationEmailHash = crypto.lookup(String(patch.email).trim().toLowerCase(), "identity:email");
            // A representation-only migration should not fake a user edit.
            if (row.updatedAt instanceof Date) data.updatedAt = row.updatedAt;
            await delegate(tx, name).update({ where: { [pk]: id }, data });
            stats.changed++;
          }
        }, { timeout: 15000 });
      }
      if (rows.length < 100) break;
      cursor = rows[rows.length - 1][pk];
    }
  }
  return report;
}

/** Encrypt and re-key referenced photos so original upload filenames no longer identify them. */
export async function migratePrivateFiles(raw: PrismaClient, driver: StorageDriver, crypto: PrivateCrypto, apply: boolean) {
  const stats = { checked: 0, plaintextFiles: 0, changed: 0, retired: 0, missingDeletedFiles: 0 };
  const targets = [
    { model: "User", fields: { avatarKey: "avatarUrl" } },
    { model: "Couple", fields: { photoKey: "photoUrl" } },
    { model: "DatePhoto", fields: { storageKey: "url", displayKey: "", thumbKey: "" } },
  ];
  for (const target of targets) {
    let cursor: string | undefined;
    for (;;) {
      const rows = await delegate(raw, target.model).findMany({ take: 100, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      for (const row of rows) for (const [field, urlField] of Object.entries(target.fields)) {
        const oldKey = row[field];
        if (typeof oldKey !== "string" || !oldKey) continue;
        if (!await driver.exists(oldKey)) {
          if (row.deletedAt) { stats.missingDeletedFiles++; continue; }
          throw new Error("An active photo is missing; private-file migration stopped.");
        }
        const original = await driver.get(oldKey); stats.checked++;
        const encrypted = encryptedBytes(original);
        if (!encrypted) stats.plaintextFiles++;
        const plain = crypto.decryptFile(original, oldKey);
        const opaque = /^[A-Za-z0-9_-]{32}(?:\.(?:display|thumb))?\.[a-z0-9]{1,8}$/.test(oldKey.slice(oldKey.lastIndexOf("/") + 1));
        if (!apply || (encrypted && opaque)) continue;
        const extension = oldKey.match(/\.([a-z0-9]{1,8})$/i)?.[1].toLowerCase() ?? "bin";
        const key = `${oldKey.slice(0, oldKey.lastIndexOf("/") + 1)}${randomBytes(24).toString("base64url")}.${extension}`;
        await raw.storageCleanup.create({ data: { key, nextAttemptAt: new Date(Date.now() + 3600000) } });
        await driver.put({ key, body: crypto.encryptFile(plain, key), contentType: "application/octet-stream" });
        const moved = await raw.$transaction(async (tx) => {
          const [table] = tables[target.model];
          await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(`"${table}"`)} WHERE id = ${row.id} FOR UPDATE`);
          const current = await delegate(tx, target.model).findUnique({ where: { id: row.id } });
          if (current?.[field] !== oldKey) return false;
          await delegate(tx, target.model).update({ where: { id: row.id }, data: {
            [field]: key, ...(urlField ? { [urlField]: croppedUrl(driver.publicUrl(key), readSavedCrop(current?.[target.model === "User" ? "avatarCrop" : target.model === "Couple" ? "photoCrop" : "crop"])) } : {}),
          } });
          await tx.storageCleanup.upsert({ where: { key: oldKey }, create: { key: oldKey, nextAttemptAt: new Date() }, update: { nextAttemptAt: new Date(), failedAt: null } });
          await tx.storageCleanup.deleteMany({ where: { key } });
          return true;
        });
        if (moved) stats.changed++;
      }
      if (rows.length < 100) break;
      cursor = String(rows[rows.length - 1].id);
    }
  }
  // Retained/unreferenced objects are also encrypted while awaiting their normal cleanup date.
  const queued = await raw.storageCleanup.findMany({ select: { id: true, key: true, nextAttemptAt: true } });
  for (const job of queued) {
    if (!await driver.exists(job.key)) continue;
    const bytes = await driver.get(job.key); stats.checked++;
    if (!encryptedBytes(bytes)) {
      stats.plaintextFiles++;
      if (apply) { await driver.put({ key: job.key, body: crypto.encryptFile(bytes, job.key), contentType: "application/octet-stream" }); stats.changed++; }
    } else crypto.decryptFile(bytes, job.key);
    if (apply && job.nextAttemptAt <= new Date()) {
      const references = await Promise.all([
        raw.user.count({ where: { avatarKey: job.key } }), raw.couple.count({ where: { photoKey: job.key } }),
        raw.datePhoto.count({ where: { OR: [{ storageKey: job.key }, { displayKey: job.key }, { thumbKey: job.key }] } }),
      ]);
      if (references.every((count) => count === 0)) { await driver.delete(job.key); await raw.storageCleanup.delete({ where: { id: job.id } }); stats.retired++; }
    }
  }
  return stats;
}
