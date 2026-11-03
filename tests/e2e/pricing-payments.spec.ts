import { expect, test, type Locator } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Phase 5 exit criterion (UI side): the owner loads a rate and a length discount, books a stay whose
// price is computed and frozen on the server, records a deposit and a payment and sees the balance;
// editing the rate afterwards leaves the booking's price as it was (invariant 8); voiding a payment
// brings the balance back. Runs on the mobile and desktop projects, one login per run.

const visible = (locator: Locator) => locator.filter({ visible: true });

test.describe("rates and guest payments", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadminId: string;
  let orgId: string;
  let propertyId: string;
  let unitId: string;

  test.beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "e2etp");
    const superadmin = await createTestUser(admin, "e2etpsuper");
    superadminId = superadmin.id;
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const { data, error } = await owner.client.rpc("register_organization", { p_name: "Org tp", p_slug: uniqueSlug("e2etp") });
    if (error) throw error;
    orgId = data as string;
    const approved = await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    if (approved.error) throw approved.error;

    const property = await owner.client
      .from("properties")
      .insert({ org_id: orgId, slug: uniqueSlug("tpp"), name: "Cabañas del Río", deposit_pct: 30 })
      .select("id")
      .single();
    if (property.error) throw property.error;
    propertyId = property.data.id;
    const unit = await owner.client
      .from("units")
      .insert({ org_id: orgId, property_id: propertyId, kind: "cabin", name: "Cabaña Sauce", max_guests: 4 })
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

  test("rate, frozen price, deposit and balance; a later rate edit keeps the price", async ({ page }) => {
    await page.goto(`/auth/login?next=${encodeURIComponent(`/panel/alojamientos/${propertyId}/tarifas`)}`);
    await page.getByLabel("Email").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();

    // A base rate of $ 10.000 per night and 10 % off from 3 nights.
    await visible(page.getByLabel("Aplica a")).selectOption(`unit:${unitId}`);
    await visible(page.getByLabel("Tipo", { exact: true })).selectOption("base");
    await visible(page.getByLabel("Nombre", { exact: true })).fill("Base");
    await visible(page.getByLabel("Precio por noche ($)")).fill("10.000");
    await visible(page.getByRole("button", { name: "Agregar tarifa" })).click();
    await expect(visible(page.getByText("Tarifa agregada."))).toBeVisible();

    await visible(page.getByLabel("Desde (noches)")).fill("3");
    await visible(page.getByLabel("Descuento (%)")).fill("10");
    await visible(page.getByRole("button", { name: "Agregar descuento" })).click();
    await expect(visible(page.getByText("Descuento agregado."))).toBeVisible();

    // Three nights: 30.000 − 10 % = 27.000; deposit 30 % = 8.100.
    await page.goto(`/panel/reservas/nueva?property=${propertyId}&fecha=2040-05-06`);
    await visible(page.getByLabel("Unidad", { exact: true })).selectOption(`unit:${unitId}`);
    await visible(page.getByLabel("Ingreso")).fill("2040-05-06");
    await visible(page.getByLabel("Salida")).fill("2040-05-09");
    await visible(page.getByLabel("Huéspedes")).fill("2");
    await visible(page.getByLabel("Estado")).selectOption("confirmed");
    await visible(page.getByLabel("Nombre del huésped")).fill("Carla Precio");
    await visible(page.getByRole("button", { name: "Registrar reserva" })).click();
    await expect(visible(page.getByText("Reserva registrada."))).toBeVisible();
    await expect(visible(page.getByTestId("booking-total"))).toHaveText(/27\.000,00/);
    await expect(visible(page.getByTestId("booking-deposit"))).toHaveText(/8\.100,00/);
    await expect(visible(page.getByTestId("booking-balance"))).toHaveText(/27\.000,00/);
    const bookingUrl = page.url().split("?")[0];

    // Deposit, then the rest.
    await visible(page.getByLabel("Concepto")).selectOption("deposit");
    await visible(page.getByLabel("Importe ($)")).fill("8.100");
    await visible(page.getByRole("button", { name: "Registrar pago" })).click();
    await expect(visible(page.getByText("Pago registrado."))).toBeVisible();
    await expect(visible(page.getByTestId("booking-balance"))).toHaveText(/18\.900,00/);

    await visible(page.getByLabel("Concepto")).selectOption("payment");
    await visible(page.getByLabel("Importe ($)")).fill("18.900");
    await visible(page.getByRole("button", { name: "Registrar pago" })).click();
    await expect(visible(page.getByText("Pago registrado."))).toBeVisible();
    await expect(visible(page.getByTestId("booking-balance"))).toHaveText(/\$\s*0,00/);

    // Invariant 8: the rate goes up, the booking keeps its frozen price.
    await page.goto(`/panel/alojamientos/${propertyId}/tarifas`);
    const rule = visible(page.getByRole("listitem").filter({ hasText: "Base · Tarifa base" }));
    await rule.getByText("Editar o borrar").click();
    await rule.getByLabel("Precio por noche ($)").fill("20.000");
    await rule.getByRole("button", { name: "Guardar tarifa" }).click();
    await expect(visible(page.getByText(/Tarifa guardada/))).toBeVisible();

    await page.goto(bookingUrl);
    await expect(visible(page.getByTestId("booking-total"))).toHaveText(/27\.000,00/);

    // Voiding the last payment brings that amount back to the balance.
    const payments = visible(page.getByRole("list", { name: "Pagos registrados" }));
    await payments.getByRole("listitem").filter({ hasText: "18.900" }).getByRole("button", { name: "Anular" }).click();
    await expect(visible(page.getByText(/Pago anulado/))).toBeVisible();
    await expect(visible(page.getByTestId("booking-balance"))).toHaveText(/18\.900,00/);

    // The guest is in the guest base, with the stay.
    await page.goto("/panel/huespedes?q=Carla");
    await expect(visible(page.getByRole("link", { name: /Carla Precio/ }))).toBeVisible();
  });
});
