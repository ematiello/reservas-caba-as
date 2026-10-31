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
  // Pages stream in behind Suspense and read from a remote Supabase project: 5 s is too tight.
  expect: { timeout: 15_000 },
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
    command: "npm run build && npm start",
    env: { PORT: String(port) },
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
