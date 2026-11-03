import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Phase 1, S8: collaborators join through an invitation link shared by the owner (no SMTP).

test.describe("invitation links", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let owner: TestUser;
  let invitee: TestUser;
  let stranger: TestUser;
  let orgId: string;
  let invitationPath: string;

  async function login(page: Page, user: TestUser, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    const superadmin = await createTestUser(admin, "teamsuper");
    owner = await createTestUser(admin, "teamowner");
    invitee = await createTestUser(admin, "teaminvitee");
    stranger = await createTestUser(admin, "teamstranger");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });

    const registered = await owner.client.rpc("register_organization", {
      p_name: "Equipo E2E",
      p_slug: uniqueSlug("team"),
    });
    orgId = registered.data as string;
    await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    // Only the setup helper needs the superadmin: drop it now.
    await admin.auth.admin.deleteUser(superadmin.id);
  });

  test.afterAll(async () => {
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    for (const user of [owner, invitee, stranger]) await admin.auth.admin.deleteUser(user.id);
  });

  test("the owner creates an operator invitation link", async ({ page }) => {
    await login(page, owner, "/panel/equipo");
    await page.getByLabel("Rol").selectOption("operator");
    await page.getByRole("button", { name: "Crear enlace de invitación" }).click();

    const link = await page.getByLabel("Enlace de invitación").inputValue();
    expect(link).toMatch(/\/auth\/invitacion\/[A-Za-z0-9_-]{16,64}$/);
    invitationPath = new URL(link).pathname;
    await expect(page.getByText("Invitaciones abiertas (1)")).toBeVisible();

    // Only the hash is stored: the raw token must not be in the database.
    const token = invitationPath.split("/").pop()!;
    const { data } = await admin.from("invitations").select("token_hash").eq("org_id", orgId);
    expect(JSON.stringify(data)).not.toContain(token);
  });

  test("an anonymous visitor is asked to sign in or create an account first", async ({ page }) => {
    await page.goto(invitationPath);
    // Inside <main>: on phones the bottom bar also has an "Ingresar" link.
    const content = page.getByRole("main");
    await expect(content.getByRole("link", { name: "Ingresar" })).toBeVisible();
    await expect(content.getByRole("link", { name: "Crear una cuenta" })).toBeVisible();
    await expect(content.getByRole("button", { name: "Aceptar invitación" })).toHaveCount(0);
  });

  test("the invitee accepts and gets the operator panel without team management", async ({ page }) => {
    await login(page, invitee, invitationPath);
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await page.waitForURL(/\/panel$/);
    await expect(page.getByText("Tu cuenta está activa")).toBeVisible();
    await expect(page.getByRole("link", { name: "Gestionar equipo" })).toHaveCount(0);

    await page.goto("/panel/equipo");
    await page.waitForURL(/\/panel$/);
  });

  test("the link cannot be used twice", async ({ page }) => {
    await login(page, stranger, invitationPath);
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page.getByText(/no es válida, ya fue usada o venció/)).toBeVisible();
  });

  test("the owner changes the role and then removes the collaborator", async ({ page }) => {
    await login(page, owner, "/panel/equipo");
    await expect(page.getByText("Integrantes (2)")).toBeVisible();

    await page.getByRole("combobox", { name: "Rol de Test teaminvitee" }).selectOption("admin");
    await page.getByRole("button", { name: "Cambiar rol de Test teaminvitee" }).click();
    await expect.poll(async () => {
      const { data } = await admin.from("memberships").select("role").eq("org_id", orgId).eq("user_id", invitee.id).single();
      return data?.role;
    }).toBe("admin");
    await expect(page.getByText("Rol actualizado.")).toBeVisible();

    await page.getByRole("button", { name: "Quitar a Test teaminvitee" }).click();
    await expect(page.getByText("Integrantes (1)")).toBeVisible();
    await expect(page.getByText("Integrante quitado.")).toBeVisible();
  });

  test("after being removed, the former collaborator loses access", async ({ page }) => {
    await login(page, invitee, "/panel");
    await expect(page.getByText("Todavía no tenés un negocio")).toBeVisible();
  });
});
