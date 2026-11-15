/** Operator-only: explicit DATABASE_URL, JSON on stdin. Never accepts a password in argv. */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { hashPassword } from "../src/lib/auth/password";
import { passwordSchema } from "../src/lib/validation/password";
import { emailSchema } from "../src/lib/validation/common";
import { nameSchema } from "../src/lib/validation/name";
import { createPrivateCrypto } from "../src/lib/privacy/crypto";
import { withPrivateData } from "../src/lib/privacy/prisma-extension";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL explicitly for the intended database.");
  const input = z.object({
    email: emailSchema, alias: emailSchema, name: nameSchema,
    password: passwordSchema.optional(),
  }).parse(JSON.parse(readFileSync(0, "utf8")));
  if (input.alias === input.email) throw new Error("The alias must differ from the receiving mailbox.");
  const crypto = createPrivateCrypto(process.env.DATA_ENCRYPTION_KEY ?? "");
  const prisma = withPrivateData(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [] }), () => crypto);
  try {
    // Existing credentials must never be replaced by an admin-grant operation.
    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (!existing && !input.password) throw new Error("A password is required when creating a new account.");
    const passwordHash = !existing && input.password ? await hashPassword(input.password) : undefined;
    const hash = (value: string) => crypto.lookup(value, "identity:email");
    const result = await prisma.$transaction(async (tx) => {
      for (const value of [input.email, input.alias].sort()) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mono:email:${hash(value)}`}, 0))::text`;
      }
      const aliasOwner = await tx.user.findUnique({ where: { email: input.alias }, select: { id: true } });
      if (aliasOwner) throw new Error("The alias is already an account mailbox; choose a different alias.");
      if (await tx.emailBlock.findUnique({ where: { emailHash: hash(input.email) } })) throw new Error("This mailbox is blocked.");
      let user = await tx.user.findUnique({ where: { email: input.email } });
      if (!user) {
        if (!passwordHash) throw new Error("Account state changed. Run provisioning again.");
        user = await tx.user.create({ data: {
          email: input.email, name: input.name, passwordHash, moderationEmailHash: hash(input.email),
        } });
      }
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      if (user.deletedAt || user.blockedAt) throw new Error("Cannot grant admin to a deleted or blocked account.");
      await tx.adminAccess.upsert({ where: { userId: user.id },
        create: { userId: user.id, loginAlias: input.alias }, update: { loginAlias: input.alias } });
      await tx.moderationAudit.create({ data: {
        actorId: user.id, targetId: user.id, action: "ADMIN_PROVISIONED",
        reason: "Operator provisioned admin access and login alias. Mailbox verification is required before access.",
      } });
      return { accountId: user.id, created: !existing, adminReady: !!user.emailVerified };
    }, { isolationLevel: "Serializable", timeout: 15000 });
    console.log(JSON.stringify(result));
  } finally { await prisma.$disconnect(); }
}

main().catch(() => {
  // Database/validation exceptions can contain input values. Keep this output secret-free.
  console.error("Admin provisioning failed. Check the mailbox, alias, account state and database configuration; existing credentials were not changed.");
  process.exitCode = 1;
});
