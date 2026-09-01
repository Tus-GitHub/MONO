import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/server-only packages out of the bundler; they run as-is on the server.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
};

export default nextConfig;
