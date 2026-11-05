import { afterAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID, createECDH, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

afterAll(() => prisma.$disconnect());

it("migrates legacy browser subscriptions to their latest owner without keeping duplicate legacy secrets", async () => {
  const schema = `backfill_${randomUUID().replaceAll("-", "")}`;
  await prisma.$transaction(async (tx) => {
    // The only identifiers interpolated into SQL are locally generated hexadecimal schema names.
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    async function apply(name: string) {
      // These three checked-in migrations contain plain DDL/DML and no procedural bodies.
      const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").replace(/^--.*$/gm, "");
      for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) {
        if (/^(BEGIN|COMMIT)$/i.test(statement)) continue;
        await tx.$executeRawUnsafe(statement);
      }
    }
    await apply("20260902000000_init");
    await apply("20261105000000_integrity_and_plan_versions");
    const key = createECDH("prime256v1"); key.generateKeys();
    const payload = {
      endpoint: "https://fcm.googleapis.com/fcm/send/legacy-fixture",
      keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
    };
    for (const [id, at] of [["old_owner", "2026-01-01"], ["current_owner", "2026-02-01"]]) {
      await tx.$executeRaw`INSERT INTO users (id, email, name, "updatedAt") VALUES (${id}, ${`${id}@example.invalid`}, 'Fixture', CURRENT_TIMESTAMP)`;
      await tx.$executeRaw`INSERT INTO notification_preferences ("userId", "pushEnabled", "pushSubscription", "updatedAt")
        VALUES (${id}, true, CAST(${JSON.stringify(payload)} AS jsonb), CAST(${at} AS timestamp))`;
    }
    await apply("20261105010000_durable_delivery_and_cleanup");
    const devices = await tx.$queryRaw<{ userId: string; endpoint: string }[]>`SELECT "userId", endpoint FROM push_subscriptions`;
    expect(devices).toEqual([{ userId: "current_owner", endpoint: payload.endpoint }]);
    const remaining = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM notification_preferences WHERE "pushSubscription" IS NOT NULL`;
    expect(Number(remaining[0].count)).toBe(0);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }, { timeout: 30_000 });
});
