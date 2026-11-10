/** Prisma's advisory migration lock needs a session connection, not Neon's transaction pool. */
export function migrationDatabaseUrl(databaseUrl, directUrl) {
  if (directUrl) return directUrl;
  const url = new URL(databaseUrl);
  if (/^ep-[a-z0-9-]+-pooler\./.test(url.hostname) && url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
  }
  return url.toString();
}
