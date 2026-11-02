import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Phase 2 end to end: the platform admin creates a plan, approves with it, records a payment and
// suspends; the owner sees the subscription and the read-only notice.

test.describe("subscriptions", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadmin: TestUser;
  let orgId: string;
  // Unique per run: the mobile and desktop projects share the same dev database.
  const orgName = `Cabañas Suscripción ${uniqueSlug("n")}`;
  const planName = `Plan E2E ${uniqueSlug("p")}`;

  async function login(page: Page, user: TestUser, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "e2esubowner");
    superadmin = await createTestUser(admin, "e2esubsuper");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const { data, error } = await owner.client.rpc("register_organization", {
      p_name: orgName,
      p_slug: uniqueSlug("e2esub"),
    });
    if (error) throw error;
    orgId = data as string;
  });

  test.afterAll(async () => {
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    const { data: plans } = await admin.from("plans").select("id").eq("name", planName);
    for (const plan of plans ?? []) {
      await admin.from("audit_log").delete().eq("record_id", plan.id);
      await admin.from("plans").delete().eq("id", plan.id);
    }
    for (const user of [owner, superadmin]) await admin.auth.admin.deleteUser(user.id);
  });

  test("the platform admin creates a plan", async ({ page }) => {
    await login(page, superadmin, "/admin/planes");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear plan" }) });
    await form.getByLabel("Nombre").fill(planName);
    await form.getByLabel(/Precio mensual/).fill("15.000");
    await form.getByLabel(/Máximo de integrantes/).fill("3");
    await form.getByRole("button", { name: "Crear plan" }).click();

    await expect(page.getByText("Plan guardado.")).toBeVisible();
    const { data } = await admin.from("plans").select("*").eq("name", planName).single();
    expect(data).toMatchObject({ price_cents: 1_500_000, max_members: 3, max_units: null, is_active: true });
  });

  test("approving with that plan starts the trial", async ({ page }) => {
    const { data: plan } = await admin.from("plans").select("id").eq("name", planName).single();
    await login(page, superadmin, "/admin");
    await page.getByLabel(`Plan para ${orgName}`).selectOption(plan!.id);
    await page.getByRole("button", { name: `Aprobar ${orgName}` }).click();

    await expect(page.getByRole("link", { name: `Gestionar ${orgName}` })).toBeVisible();
    const { data: sub } = await admin.from("subscriptions").select("status, plan_id").eq("org_id", orgId).single();
    expect(sub).toEqual({ status: "trial", plan_id: plan!.id });
  });

  test("the platform admin records a payment and the account becomes active", async ({ page }) => {
    await login(page, superadmin, `/admin/organizaciones/${orgId}`);
    await expect(page.getByText("Estado: En prueba")).toBeVisible();
    await expect(page.getByLabel("Importe (ARS)")).toHaveValue("15.000");
    await page.getByLabel("Medio").selectOption("transfer");
    await page.getByLabel("Notas").fill("ref e2e");
    await page.getByRole("button", { name: "Registrar pago" }).click();

    await expect(page.getByText("Pago registrado. El período se extendió.")).toBeVisible();
    await expect(page.getByText("Estado: Activa")).toBeVisible();
    const { data: payments } = await admin.from("subscription_payments").select("amount_cents, method, notes").eq("org_id", orgId);
    expect(payments).toEqual([{ amount_cents: 1_500_000, method: "transfer", notes: "ref e2e" }]);
  });

  test("the owner sees the plan and the payment", async ({ page }) => {
    await login(page, owner, "/panel/suscripcion");
    await expect(page.getByText(`${orgName} · Activa`)).toBeVisible();
    await expect(page.getByText(new RegExp(`Plan: ${planName}`))).toBeVisible();
    await expect(page.getByText(/Transferencia · \$\s?15\.000,00/)).toBeVisible();
  });

  test("after a suspension the owner's panel is read-only", async ({ page, browser }) => {
    await login(page, superadmin, `/admin/organizaciones/${orgId}`);
    await page.getByRole("button", { name: "Suspender" }).click();
    await expect(page.getByText(/Cuenta suspendida/)).toBeVisible();

    const ownerPage = await (await browser.newContext()).newPage();
    await login(ownerPage, owner, "/panel");
    await expect(ownerPage.getByText(/está suspendida, vencida, dada de baja o desactivada: el panel queda en solo lectura/)).toBeVisible();
    await ownerPage.goto("/panel/suscripcion");
    await expect(ownerPage.getByText(/Tu cuenta está suspendida/)).toBeVisible();
    await ownerPage.context().close();
  });
});
