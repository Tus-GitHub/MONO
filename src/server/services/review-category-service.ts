import "server-only";

import type { Prisma } from "@prisma/client";

import { DEFAULT_REVIEW_CATEGORIES } from "@/lib/review/default-categories";

export { DEFAULT_REVIEW_CATEGORIES } from "@/lib/review/default-categories";

/** Create any missing default categories for a couple. Safe to call repeatedly. */
export async function ensureDefaultReviewCategories(
  tx: Prisma.TransactionClient,
  coupleId: string,
): Promise<void> {
  await tx.reviewCategory.createMany({
    data: DEFAULT_REVIEW_CATEGORIES.map((category, index) => ({
      coupleId,
      key: category.key,
      label: category.label,
      description: category.description,
      sortOrder: index,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
}
