import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, createTestUser, hasDbEnv, uniqueSlug, type TestUser } from "../db/helpers";

// Exit criterion of Phase 1: /panel and /admin are protected on the server.

test.describe("anonymous visitors", () => {
  for (const path of ["/panel", "/admin"]) {
    test(`${path} sends them to the login page and keeps the target`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/auth\/login\?next=/);
      expect(new URL(page.url()).searchParams.get("next")).toBe(path);
      await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
    });

    test(`${path} never sends private content to the browser`, async ({ request }) => {
      const body = await (await request.get(path)).text();
      expect(body).not.toMatch(/Solicitudes de organizaciones|Registrá tu negocio|Tu solicitud/);
    });
  }
});

test.describe("signed-in users", () => {
  test.skip(!hasDbEnv, "needs the dev Supabase keys in .env.local");
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadmin: TestUser;

  async function login(page: Page, user: TestUser, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "e2eowner");
    superadmin = await createTestUser(admin, "e2esuper");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
  });

  test.afterAll(async () => {
    const { data } = await admin.from("memberships").select("org_id").eq("user_id", owner.id);
    const orgIds = (data ?? []).map((r) => r.org_id);
    if (orgIds.length) {
      await admin.from("audit_log").delete().in("org_id", orgIds);
      await admin.from("organizations").delete().in("id", orgIds);
    }
    for (const user of [owner, superadmin]) await admin.auth.admin.deleteUser(user.id);
  });

  test("a user without a business registers one and sees the pending screen", async ({ page }) => {
    await login(page, owner, "/panel");
    await expect(page.getByText("Todavía no tenés un negocio")).toBeVisible();

    await page.getByLabel("Nombre de tu negocio").fill("Cabañas E2E");
    await page.getByLabel(/Dirección pública/).fill(uniqueSlug("e2e"));
    await page.getByRole("button", { name: "Registrar mi negocio" }).click();

    await expect(page.getByText("Tu solicitud está en revisión")).toBeVisible();
  });

  test("a regular user cannot reach /admin", async ({ page }) => {
    await login(page, owner, "/admin");
    await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
    await expect(page.getByText("Solicitudes de organizaciones")).toHaveCount(0);
  });

  test("a platform admin reaches /admin", async ({ page }) => {
    await login(page, superadmin, "/admin");
    await expect(page.getByText("Solicitudes de organizaciones")).toBeVisible();
  });

  test("once approved, the owner sees the active panel", async ({ page }) => {
    const { data } = await admin.from("memberships").select("org_id").eq("user_id", owner.id).single();
    const review = await superadmin.client.rpc("review_organization", { p_org: data?.org_id, p_approve: true });
    expect(review.error).toBeNull();

    await login(page, owner, "/panel");
    await expect(page.getByText("Tu cuenta está activa")).toBeVisible();
  });

  test("logging out returns to the login page and closes access", async ({ page }) => {
    await login(page, owner, "/panel");
    await expect(page.getByText("Tu cuenta está activa")).toBeVisible();
    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL(/\/auth\/login/);
    await page.goto("/panel");
    await page.waitForURL(/\/auth\/login\?next=/);
  });
});
