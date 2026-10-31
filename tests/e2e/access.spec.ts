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
  // Unique per run: the mobile and desktop projects share the same dev database.
  const orgName = `Cabañas E2E ${uniqueSlug("n")}`;

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

    await page.getByLabel("Nombre de tu negocio").fill(orgName);
    await page.getByLabel(/Dirección pública/).fill(uniqueSlug("e2e"));
    await page.getByRole("button", { name: "Registrar mi negocio" }).click();

    await expect(page.getByText("Tu solicitud está en revisión")).toBeVisible();
  });

  test("a regular user cannot reach /admin", async ({ page }) => {
    await login(page, owner, "/admin");
    await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
    await expect(page.getByText("Solicitudes de organizaciones")).toHaveCount(0);
  });

  test("a platform admin sees the pending request and approves it", async ({ page }) => {
    await login(page, superadmin, "/admin");
    await expect(page.getByText(/Solicitudes de organizaciones/)).toBeVisible();
    await expect(page.getByText(orgName)).toBeVisible();

    await page.getByRole("button", { name: `Aprobar ${orgName}` }).click();
    await expect(page.getByRole("button", { name: `Aprobar ${orgName}` })).toHaveCount(0);
    await expect(page.getByText(orgName)).toBeVisible(); // now listed under "Activas"

    const { data } = await admin.from("organizations").select("status, approved_by").eq("name", orgName).single();
    expect(data).toEqual({ status: "active", approved_by: superadmin.id });
  });

  test("a platform admin rejects a request and the applicant sees it", async ({ page }) => {
    const applicant = await createTestUser(admin, "e2erejected");
    const rejectedName = `Rechazada E2E ${uniqueSlug("r")}`;
    const created = await applicant.client.rpc("register_organization", { p_name: rejectedName, p_slug: uniqueSlug("rej") });
    expect(created.error).toBeNull();
    try {
      await login(page, superadmin, "/admin");
      await page.getByRole("button", { name: `Rechazar ${rejectedName}` }).click();
      await expect(page.getByRole("button", { name: `Rechazar ${rejectedName}` })).toHaveCount(0);

      await page.getByRole("button", { name: "Salir" }).click();
      await login(page, applicant, "/panel");
      await expect(page.getByText("Tu solicitud no fue aprobada")).toBeVisible();
    } finally {
      await admin.from("audit_log").delete().eq("org_id", created.data as string);
      await admin.from("organizations").delete().eq("id", created.data as string);
      await admin.auth.admin.deleteUser(applicant.id);
    }
  });

  test("once approved, the owner sees the active panel", async ({ page }) => {
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
