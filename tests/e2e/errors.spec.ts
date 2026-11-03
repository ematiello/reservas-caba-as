import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Error log panel (odd/tasks/panel-errores-y-limpieza-dev.md): the platform admin reads the grouped
// errors, filters them and triages; nobody else gets in.

test.describe("error log", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let superadmin: TestUser;
  let owner: TestUser;
  // Unique per run: the mobile and desktop projects share the same dev database.
  const run = uniqueSlug("e2eerr");
  const message = `Fallo de prueba ${run}`;
  const fingerprint = `${run}-fp`;

  async function login(page: Page, user: TestUser, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    superadmin = await createTestUser(admin, "e2eerrsuper");
    owner = await createTestUser(admin, "e2eerrowner");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    for (let i = 0; i < 2; i++) {
      const { error } = await admin.rpc("log_error", {
        p_fingerprint: fingerprint,
        p_source: "server",
        p_severity: "error",
        p_message: message,
        p_detail: "stack de prueba",
        p_route: "/panel/reservas",
      });
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    const { data } = await admin.from("error_log").select("id").eq("fingerprint", fingerprint);
    const ids = (data ?? []).map((r) => String(r.id));
    if (ids.length) await admin.from("audit_log").delete().eq("table_name", "error_log").in("record_id", ids);
    await admin.from("error_log").delete().eq("fingerprint", fingerprint);
    const userIds = [superadmin.id, owner.id];
    await admin.from("platform_admins").delete().in("user_id", userIds);
    await admin.from("audit_log").delete().eq("table_name", "platform_admins").in("record_id", userIds);
    for (const user of [superadmin, owner]) await admin.auth.admin.deleteUser(user.id);
  });

  test("the platform admin sees the grouped error, resolves it and reopens it", async ({ page }) => {
    await login(page, superadmin, "/admin/errores");
    await expect(page.getByText(/Errores del sistema/)).toBeVisible();

    const item = page.getByRole("listitem").filter({ hasText: message });
    await expect(item).toBeVisible();
    await expect(item).toContainText("2 veces");
    await expect(item).toContainText("/panel/reservas");

    await item.getByRole("button", { name: "Marcar resuelto" }).click();
    await expect(page.getByText("Error marcado como resuelto")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: message })).toHaveCount(0);

    await page.getByRole("link", { name: "Resueltos" }).click();
    const resolved = page.getByRole("listitem").filter({ hasText: message });
    await expect(resolved).toBeVisible();
    await resolved.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByText("Error reabierto")).toBeVisible();

    await page.getByRole("link", { name: "Abiertos" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: message })).toBeVisible();
  });

  test("an owner gets a 404, so the route is not revealed", async ({ page }) => {
    await login(page, owner, "/admin/errores");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByText(message)).toHaveCount(0);
  });
});
