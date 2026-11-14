import { ExpensePayer } from "@prisma/client";
import type { LocalPlan, LocalPlaceChoice } from "@/lib/validation/new-plan";

export function emptyLocalPlan(currency: string, title = "", place: LocalPlaceChoice | null = null): LocalPlan {
  return { key: "", title, place, category: "", date: "", startTime: "", endTime: "", notes: "",
    expectedTotal: "", budgetMin: "", budgetMax: "", currency, split: ExpensePayer.SHARED, activities: [] };
}
