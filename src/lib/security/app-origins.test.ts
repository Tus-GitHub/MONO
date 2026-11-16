import { expect, it } from "vitest";
import { AMOR_ORIGIN, LEGACY_ORIGIN, isAppOrigin } from "./app-origins";

it.each([AMOR_ORIGIN, LEGACY_ORIGIN])("keeps both owned addresses working when deployed at %s", (configured) => {
  expect(isAppOrigin(AMOR_ORIGIN, configured)).toBe(true);
  expect(isAppOrigin(LEGACY_ORIGIN, configured)).toBe(true);
  for (const origin of [null, "null", "https://attacker.test", "https://amor-together.vercel.app.attacker.test", "http://amor-together.vercel.app", "https://other.vercel.app"])
    expect(isAppOrigin(origin, configured)).toBe(false);
});

it("does not grant production origins access to local or preview environments", () => {
  for (const configured of ["http://localhost:3000", "https://preview.vercel.app"]) {
    expect(isAppOrigin(configured, configured)).toBe(true);
    expect(isAppOrigin(AMOR_ORIGIN, configured)).toBe(false);
    expect(isAppOrigin(LEGACY_ORIGIN, configured)).toBe(false);
  }
});
