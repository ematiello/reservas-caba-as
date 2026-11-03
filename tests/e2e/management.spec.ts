import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Management screens (odd/tasks/gestion-propietario-superadmin.md): the owner edits the organization,
// a category, deletes a property, loads a holiday and reads the activity; the platform admin edits,
// deactivates, cancels and reactivates the organization, reads its operation and manages admins.

test.describe("management", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadmin: TestUser;
  let candidate: TestUser;
  let orgId: string;
  let propertyId: string;
  // Unique per run: the mobile and desktop projects share the same dev database.
  const newOrgName = `Cabañas Gestión ${uniqueSlug("n")}`;
  const newSlug = uniqueSlug("e2egestion");

  async function login(page: Page, user: TestUser, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "e2emgmtowner");
    superadmin = await createTestUser(admin, "e2emgmtsuper");
    candidate = await createTestUser(admin, "e2emgmtcand");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const { data, error } = await owner.client.rpc("register_organization", {
      p_name: "Org gestión",
      p_slug: uniqueSlug("e2emgmt"),
    });
    if (error) throw error;
    orgId = data as string;
    const approved = await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    if (approved.error) throw approved.error;

    const property = await owner.client
      .from("properties")
      .insert({ org_id: orgId, name: "Complejo a borrar", slug: uniqueSlug("borrar") })
      .select("id")
      .single();
    if (property.error) throw property.error;
    propertyId = property.data.id;
    const category = await owner.client
      .from("unit_categories")
      .insert({ org_id: orgId, property_id: propertyId, name: "Suites" });
    if (category.error) throw category.error;
  });

  test.afterAll(async () => {
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("holidays").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    for (const user of [owner, superadmin, candidate]) {
      await admin.from("platform_admins").delete().eq("user_id", user.id);
      await admin.from("audit_log").delete().eq("record_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("the owner edits the organization and a category, deletes a property, loads a holiday and reads the activity", async ({
    page,
  }) => {
    await login(page, owner, "/panel/organizacion");
    await page.getByLabel("Nombre del negocio").fill("Org gestión renombrada");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Datos guardados.")).toBeVisible();

    await page.goto(`/panel/alojamientos/${propertyId}`);
    const categoryForm = page.locator("form").filter({ has: page.getByLabel("Nombre de la categoría Suites") });
    await categoryForm.getByLabel("Nombre de la categoría Suites").fill("Suites dobles");
    await categoryForm.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Categoría guardada.")).toBeVisible();
    const { data: categories } = await admin.from("unit_categories").select("name").eq("property_id", propertyId);
    expect(categories).toEqual([{ name: "Suites dobles" }]);

    await page.getByLabel("Entiendo que no se puede deshacer").check();
    await page.getByRole("button", { name: "Eliminar establecimiento" }).click();
    await expect(page.getByText("Establecimiento eliminado.")).toBeVisible();
    const { data: gone } = await admin.from("properties").select("id").eq("id", propertyId);
    expect(gone).toEqual([]);

    await page.goto("/panel/feriados");
    await page.getByLabel("Fecha").fill("2031-07-15");
    await page.getByLabel("Nombre").fill("Fiesta patronal e2e");
    await page.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByText("Feriado agregado.")).toBeVisible();
    const { data: holidays } = await admin.from("holidays").select("date, name").eq("org_id", orgId);
    expect(holidays).toEqual([{ date: "2031-07-15", name: "Fiesta patronal e2e" }]);

    await page.goto("/panel/organizacion/actividad");
    await expect(page.getByText("Alta de feriado").first()).toBeVisible();
    await expect(page.getByText("Baja de establecimiento").first()).toBeVisible();
  });

  test("the platform admin edits, reads the operation, cancels, reactivates and deactivates the organization", async ({
    page,
    browser,
  }) => {
    await login(page, superadmin, `/admin/organizaciones/${orgId}`);
    await page.getByLabel("Nombre", { exact: true }).fill(newOrgName);
    await page.getByLabel("Dirección pública").fill(newSlug);
    await page.getByRole("button", { name: "Guardar datos" }).click();
    await expect(page.getByText("Datos de la organización guardados.")).toBeVisible();
    const { data: org } = await admin.from("organizations").select("name, slug").eq("id", orgId).single();
    expect(org).toEqual({ name: newOrgName, slug: newSlug });

    await page.getByRole("link", { name: "Ver reservas" }).click();
    await expect(page.getByText("Esta organización todavía no tiene reservas.")).toBeVisible();
    await page.goto(`/admin/organizaciones/${orgId}/huespedes`);
    await expect(page.getByText("Esta organización todavía no tiene huéspedes.")).toBeVisible();
    await page.goto(`/admin/actividad?org=${orgId}`);
    await expect(page.getByText("La plataforma consultó las reservas").first()).toBeVisible();
    await expect(page.getByText("La plataforma consultó los huéspedes").first()).toBeVisible();

    await page.goto(`/admin/organizaciones/${orgId}`);
    await page.getByLabel("Quiero dar de baja esta suscripción").check();
    await page.getByRole("button", { name: "Dar de baja", exact: true }).click();
    await expect(page.getByText("Suscripción dada de baja.")).toBeVisible();
    let { data: sub } = await admin.from("subscriptions").select("status").eq("org_id", orgId).single();
    expect(sub).toEqual({ status: "cancelled" });

    await page.getByRole("button", { name: "Reactivar", exact: true }).click();
    await expect(page.getByText("Cuenta reactivada hasta la fecha elegida.")).toBeVisible();
    ({ data: sub } = await admin.from("subscriptions").select("status").eq("org_id", orgId).single());
    expect(sub).toEqual({ status: "active" });

    await page.getByLabel("Quiero desactivar esta organización").check();
    await page.getByRole("button", { name: "Desactivar", exact: true }).click();
    await expect(page.getByText(/^Organización desactivada:/)).toBeVisible();

    const ownerPage = await (await browser.newContext()).newPage();
    await login(ownerPage, owner, "/panel");
    await expect(ownerPage.getByText(/dada de baja o desactivada: el panel queda en solo lectura/)).toBeVisible();
    await ownerPage.context().close();

    await page.getByRole("button", { name: "Activar", exact: true }).click();
    await expect(page.getByText("Organización activada de nuevo.")).toBeVisible();
    const { data: enabled } = await admin.from("organizations").select("disabled_at").eq("id", orgId).single();
    expect(enabled).toEqual({ disabled_at: null });
  });

  test("the platform admin adds and removes another admin, never themselves", async ({ page }) => {
    await login(page, superadmin, "/admin/administradores");
    await expect(page.getByText("Vos")).toBeVisible();
    await page.getByLabel("Email").fill(candidate.email);
    await page.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByText(/^Administrador agregado/)).toBeVisible();
    const { data: added } = await admin.from("platform_admins").select("user_id").eq("user_id", candidate.id);
    expect(added).toEqual([{ user_id: candidate.id }]);

    await page.getByRole("button", { name: `Quitar a ${candidate.email}` }).click();
    await expect(page.getByText("Administrador quitado.")).toBeVisible();
    const { data: removed } = await admin.from("platform_admins").select("user_id").eq("user_id", candidate.id);
    expect(removed).toEqual([]);
  });
});
