import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
});

test("health endpoint reports status without exposing secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  const body = await response.json();

  expect(["ok", "degraded"]).toContain(body.status);
  expect(JSON.stringify(body)).not.toMatch(/sb_(publishable|secret)_|supabase\.co/);
});
