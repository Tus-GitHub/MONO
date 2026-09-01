/**
 * Database seed.
 *
 * MONO has no global seed data: every couple gets its own review categories at creation time
 * (see `DEFAULT_REVIEW_CATEGORIES`). This script backfills those defaults for any couple that
 * is missing them, so it is safe to run repeatedly and against an empty database.
 *
 * Run with: `npm run db:seed`
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { DEFAULT_REVIEW_CATEGORIES } from "../src/lib/review/default-categories";

// Minimal .env loader so the script works under plain `tsx` (no dotenv dependency).
function loadDotEnv(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      let value = (match[2] ?? "").trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // no .env file — rely on the ambient environment
  }
}

loadDotEnv();

const prisma = new PrismaClient();

async function main() {
  const couples = await prisma.couple.findMany({ select: { id: true } });

  for (const couple of couples) {
    await prisma.reviewCategory.createMany({
      data: DEFAULT_REVIEW_CATEGORIES.map((category, index) => ({
        coupleId: couple.id,
        key: category.key,
        label: category.label,
        description: category.description,
        sortOrder: index,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `Seed complete: ensured ${DEFAULT_REVIEW_CATEGORIES.length} default review categories for ${couples.length} couple(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
