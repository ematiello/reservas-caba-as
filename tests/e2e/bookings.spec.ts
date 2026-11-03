import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Phase 4 exit criterion (UI side): a member books a unit, sees it on the calendar, the database
// rejects an overlapping booking with a readable message, and cancelling frees the dates.
// Runs on the mobile and desktop projects. One login per run (Supabase Auth rate-limits logins).

// cacheComponents keeps the previous route mounted and hidden: only act on visible fields.
const visible = (locator: Locator) => locator.filter({ visible: true });

test.describe("bookings", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadminId: string;
  let orgId: string;
  let propertyId: string;
  let unitId: string;

  // Far-future dates so "today" never matters. Each project runs its own beforeAll, so its own org.
  const d = { in: "2040-03-10", out: "2040-03-13", overlapIn: "2040-03-12", overlapOut: "2040-03-14" };

  async function newBooking(page: Page, from: string, to: string, guest: string) {
    await page.goto(`/panel/reservas/nueva?property=${propertyId}&fecha=${from}`);
    await visible(page.getByLabel("Unidad", { exact: true })).selectOption(`unit:${unitId}`);
    await visible(page.getByLabel("Ingreso")).fill(from);
    await visible(page.getByLabel("Salida")).fill(to);
    await visible(page.getByLabel("Huéspedes")).fill("2");
    await visible(page.getByLabel("Estado")).selectOption("confirmed");
    await visible(page.getByLabel("Nombre del huésped")).fill(guest);
    await visible(page.getByRole("button", { name: "Registrar reserva" })).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "e2ebk");
    const superadmin = await createTestUser(admin, "e2ebksuper");
    superadminId = superadmin.id;
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const { data, error } = await owner.client.rpc("register_organization", { p_name: "Org bk", p_slug: uniqueSlug("e2ebk") });
    if (error) throw error;
    orgId = data as string;
    const approved = await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    if (approved.error) throw approved.error;

    const property = await owner.client
      .from("properties")
      .insert({ org_id: orgId, slug: uniqueSlug("bkp"), name: "Cabañas del Lago" })
      .select("id")
      .single();
    if (property.error) throw property.error;
    propertyId = property.data.id;
    const unit = await owner.client
      .from("units")
      .insert({ org_id: orgId, property_id: propertyId, kind: "cabin", name: "Cabaña Norte", max_guests: 4 })
      .select("id")
      .single();
    if (unit.error) throw unit.error;
    unitId = unit.data.id;
  });

  test.afterAll(async () => {
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    for (const id of [owner.id, superadminId]) await admin.auth.admin.deleteUser(id);
  });

  test("book, see it on the calendar, reject an overlap, cancel and rebook", async ({ page }) => {
    const guest = `Ana ${uniqueSlug("g")}`;

    await page.goto(`/auth/login?next=${encodeURIComponent("/panel")}`);
    await page.getByLabel("Email").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await visible(page.getByRole("link", { name: "Reservas", exact: true })).click();
    await expect(visible(page.getByRole("link", { name: "Nueva reserva o bloqueo" }))).toBeVisible();

    // Book.
    await newBooking(page, d.in, d.out, guest);
    await expect(visible(page.getByText("Reserva registrada."))).toBeVisible();
    await expect(visible(page.getByTestId("booking-status"))).toHaveText("Confirmada");
    const bookingUrl = page.url().split("?")[0];

    // On the calendar.
    await page.goto(`/panel/reservas?property=${propertyId}&vista=semana&fecha=${d.in}`);
    await expect(visible(page.getByRole("table")).getByRole("link", { name: guest })).toBeVisible();

    // Overlap rejected by the database.
    await newBooking(page, d.overlapIn, d.overlapOut, "Beto Solapado");
    await expect(visible(page.getByText(/se superponen con otra reserva/))).toBeVisible();

    // Cancel frees the dates.
    await page.goto(bookingUrl);
    await visible(page.getByRole("button", { name: "Cancelar" })).click();
    await expect(visible(page.getByText("Cancelada: las fechas quedaron libres."))).toBeVisible();
    await expect(visible(page.getByTestId("booking-status"))).toHaveText("Cancelada");

    await newBooking(page, d.overlapIn, d.overlapOut, "Beto Solapado");
    await expect(visible(page.getByText("Reserva registrada."))).toBeVisible();
  });
});
