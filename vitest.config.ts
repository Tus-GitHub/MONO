import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure business-rule modules under `src/lib/**` (scoring, reveal, lifecycle,
 * splits, insights) plus a focused authorization test with a mocked database. Node environment,
 * no DOM — these modules never touch React or the browser.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // `server-only` / `client-only` are build-time guards with nothing to execute in a test.
      "server-only": resolve(__dirname, "test/empty-module.ts"),
      "client-only": resolve(__dirname, "test/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    clearMocks: true,
  },
});
