import { expect, it } from "vitest";
import { categoryFromPlanTitle, providerCategoryFor, venueCategoryKey, PLAN_CATEGORIES } from "./plan-discovery";
import { PlaceCategory } from "@prisma/client";

it.each([
  ["Adventure activity", "activities"], ["Coffee together", "cafe"], ["Dinner date", "restaurant"],
  ["Movie night", "cinema"], ["Museum wander", "museum"], ["Nature walk", "park"],
  ["Shopping afternoon", "shopping"], ["Staycation", "staycation"], ["Café hopping", "cafe"],
  ["Drinks together", "bar"],
  ["Friday night out", null], ["Firewall repairs", null],
])("selects the matching filter for %s", (title, key) => expect(categoryFromPlanTitle(title)).toBe(key));
it("maps every displayed plan category to an existing venue filter and preserves explicit All", () => {
  for (const category of PLAN_CATEGORIES) expect(venueCategoryKey(category.key)).not.toBeNull();
  expect(venueCategoryKey("adventure")).toBe("activities");
  expect(venueCategoryKey("nature")).toBe("park");
  expect(venueCategoryKey("all")).toBeNull();
  expect(venueCategoryKey("unknown")).toBeNull();
});
it("chooses a browsable provider category without dropping saved home/staycation results", () => {
  expect(providerCategoryFor([PlaceCategory.HOME, PlaceCategory.TRAVEL])).toBe(PlaceCategory.TRAVEL);
  expect(providerCategoryFor([PlaceCategory.CAFE])).toBe(PlaceCategory.CAFE);
  expect(providerCategoryFor(undefined)).toBeNull();
});
