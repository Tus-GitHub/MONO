import { createHash } from "node:crypto";
import { ValidationError } from "@/lib/errors";

interface Cursor { key: string; saved: number; external: number | null; provider: string | null }
export const venueSearchKey = (query: unknown) => createHash("sha256").update(JSON.stringify(query)).digest("hex").slice(0, 24);
export const encodeVenueCursor = (value: Cursor) => Buffer.from(JSON.stringify({ v: 1, ...value })).toString("base64url");
export function decodeVenueCursor(value: string | undefined, key: string): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const row = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const offset = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 1_000_000;
    if (row.v !== 1 || row.key !== key || !offset(row.saved) || (row.external !== null && !offset(row.external))
      || (row.provider !== null && !["indiarestros", "photon", "google"].includes(row.provider)) || (row.external !== null && !row.provider)) throw new Error();
    return row;
  } catch { throw new ValidationError("This search has changed. Search again to load more places."); }
}
