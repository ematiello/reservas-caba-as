import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// D26: a visitor searches by place or name from the home page, narrows to free properties for some
// dates, and opens a result that already checks those dates.

test.describe("search", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadmin: TestUser;
  let orgId: string;
  // A word nobody else uses keeps other dev data out of the results.
  const tag = `zx${Math.random().toString(36).slice(2, 7)}`;

  test.beforeAll(async () => {
    admin = adminClient();
    [owner, superadmin] = await Promise.all([createTestUser(admin, "e2ebus"), createTestUser(admin, "e2ebussuper")]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const org = await owner.client.rpc("register_organization", { p_name: "Org bus", p_slug: uniqueSlug("e2ebus") });
    if (org.error) throw org.error;
    orgId = org.data as string;
    const approved = await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    if (approved.error) throw approved.error;

    const properties = await owner.client
      .from("properties")
      .insert([
        { org_id: orgId, slug: uniqueSlug("rio"), name: `Cabañas del Río ${tag}`, city: "Mina Clavero", province: "Córdoba", is_published: true },
        { org_id: orgId, slug: uniqueSlug("alamos"), name: `Hostería Los Álamos ${tag}`, city: "Nono", province: "Córdoba", is_published: true },
      ])
      .select("id, name");
    if (properties.error) throw properties.error;
    const rio = properties.data.find((p) => p.name.startsWith("Cabañas"))!.id;
    const alamos = properties.data.find((p) => p.name.startsWith("Hostería"))!.id;
    const units = await owner.client
      .from("units")
      .insert([
        { org_id: orgId, property_id: rio, kind: "cabin", name: "Cabaña Molle", max_guests: 4, is_published: true },
        { org_id: orgId, property_id: alamos, kind: "room", name: "Habitación 1", max_guests: 2, is_published: true },
      ])
      .select("id, name");
    if (units.error) throw units.error;
    const molle = units.data.find((u) => u.name === "Cabaña Molle")!.id;
    const booked = await owner.client.rpc("create_booking", {
      p_unit: molle,
      p_check_in: "2041-09-10",
      p_check_out: "2041-09-14",
      p_kind: "booking",
      p_status: "confirmed",
      p_guests_count: 2,
      p_guest_name: "Huésped Privado",
    });
    if (booked.error) throw booked.error;
  });

  test.afterAll(async () => {
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    for (const id of [owner.id, superadmin.id]) await admin.auth.admin.deleteUser(id);
  });

  test("search by place, then by free dates, and open a result on those dates", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("search");
    await bar.getByLabel("¿Dónde querés ir?").fill(`${tag} mina clavero`);
    await bar.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/buscar\?/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(`1 alojamiento para «${tag} mina clavero»`);
    await expect(page.getByRole("link", { name: new RegExp(`Cabañas del Río ${tag}`) })).toBeVisible();

    // Both properties by the shared word; on the booked nights only the Álamos is free.
    const form = page.getByRole("search");
    await form.getByLabel("¿Dónde querés ir?").fill(tag);
    await form.getByLabel("Fecha de ingreso").fill("2041-09-11");
    await form.getByLabel("Fecha de egreso").fill("2041-09-13");
    await form.getByLabel("Huéspedes").fill("2");
    await form.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      `1 alojamiento para «${tag}», libres del 11/09/2041 al 13/09/2041, para 2 huéspedes`,
    );
    const result = page.getByRole("link", { name: new RegExp(`Hostería Los Álamos ${tag}`) });
    await expect(result).toContainText("1 unidad libre en esas fechas");
    await expect(page.getByText(`Cabañas del Río ${tag}`)).toHaveCount(0);

    await result.click();
    await expect(page.getByRole("heading", { level: 1, name: `Hostería Los Álamos ${tag}` })).toBeVisible();
    await expect(page.getByText("Del 11/09/2041 al 13/09/2041: 2 noches, 2 huéspedes.")).toBeVisible();

    if (process.env.E2E_SHOTS) {
      const project = test.info().project.name;
      await page.goto(`/buscar?q=${tag}`);
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/buscar-${project}.png`, fullPage: true });
      await page.goto("/");
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/home-${project}.png`, fullPage: true });
    }
  });

  test("a half date range explains what to fix", async ({ page }) => {
    await page.goto(`/buscar?q=${tag}&ingreso=2041-09-11`);
    await expect(page.getByRole("alert").filter({ hasText: "Revisá la búsqueda" })).toBeVisible();
  });
});
