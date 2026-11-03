import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Same .env.local the app uses: DB-backed e2e tests create throwaway users with the secret key.
loadEnvConfig(process.cwd());

const port = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Four workers plus the standalone server ran this machine out of memory and the server died
  // mid-run. Two is the default; E2E_WORKERS overrides it.
  workers: Number(process.env.E2E_WORKERS) || 2,
  // Pages stream in behind Suspense and read from a remote Supabase project: 5 s is too tight.
  expect: { timeout: 15_000 },
  // Setup hooks create several users against the remote project, which sometimes takes 15 s or more
  // per request: 30 s per test or hook was not enough.
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  // Mobile-first: every flow runs on a phone viewport and on desktop.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // The preflight stops the run in seconds when Supabase is unreachable, before the build.
    command: "node scripts/e2e-preflight.mjs && npm run build && npm start",
    env: { PORT: String(port) },
    url: `http://localhost:${port}`,
    // Never test against whatever already listens on the port (it may be an old build): a busy port
    // fails loudly. Set E2E_REUSE_SERVER=1 only for a server you just started from the current build.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
