import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/db/**/*.test.ts"],
    // DB tests run against the dev Supabase project; keys come from .env.local (never committed).
    env: loadEnv(mode, process.cwd(), ""),
    // Sign-ins wait out the Auth rate limit (tests/db/helpers.ts), which can take minutes.
    testTimeout: 180_000,
    hookTimeout: 300_000,
  },
}));
