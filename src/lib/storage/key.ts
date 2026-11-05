/** Keys are canonical owner-scoped paths, never traversal paths or absolute file names. */
export function isCanonicalStorageKey(key: string): boolean {
  if (!key || key.length > 1024 || !/^(users|couples)\/[a-z0-9_-]+\//i.test(key)) return false;
  if (key.includes("\\") || /[\x00-\x1f\x7f]/.test(key)) return false;
  return key.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}
