import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Phase 6 (docs/04): public page → check dates → WhatsApp link. A visitor needs no login. The page
// shows which units are free and the server's list price; it never books. A suspended account
// shows "no disponible", a draft is 404, and the panel is not indexable.

test.describe("public page", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let admin: SupabaseClient;
  let owner: TestUser;
  let superadmin: TestUser;
  let orgId: string;
  let slug: string;
  let draftSlug: string;

  test.beforeAll(async () => {
    admin = adminClient();
    [owner, superadmin] = await Promise.all([createTestUser(admin, "e2epub"), createTestUser(admin, "e2epubsuper")]);
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const org = await owner.client.rpc("register_organization", { p_name: "Org pub", p_slug: uniqueSlug("e2epub") });
    if (org.error) throw org.error;
    orgId = org.data as string;
    const approved = await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    if (approved.error) throw approved.error;

    slug = uniqueSlug("arroyo");
    draftSlug = uniqueSlug("borrador");
    const property = await owner.client
      .from("properties")
      .insert({
        org_id: orgId,
        slug,
        name: "Cabañas del Arroyo",
        description: "Cabañas junto al arroyo, a cinco cuadras del centro de Nono.",
        city: "Nono",
        province: "Córdoba",
        whatsapp: "5493544123456",
        check_in_time: "14:00",
        check_out_time: "10:00",
        deposit_pct: 30,
        is_published: true,
      })
      .select("id")
      .single();
    if (property.error) throw property.error;
    const draft = await owner.client.from("properties").insert({ org_id: orgId, slug: draftSlug, name: "Borrador" });
    if (draft.error) throw draft.error;

    const units = await owner.client
      .from("units")
      .insert([
        { org_id: orgId, property_id: property.data.id, kind: "cabin", name: "Cabaña Sauce", max_guests: 4, sort: 1, is_published: true },
        { org_id: orgId, property_id: property.data.id, kind: "cabin", name: "Cabaña Aromo", max_guests: 2, sort: 2, is_published: true },
      ])
      .select("id, name");
    if (units.error) throw units.error;
    const sauce = units.data.find((u) => u.name === "Cabaña Sauce")!.id;
    const aromo = units.data.find((u) => u.name === "Cabaña Aromo")!.id;

    const rate = await owner.client
      .from("rate_rules")
      .insert({ org_id: orgId, property_id: property.data.id, unit_id: sauce, kind: "base", name: "Base", price_cents: 5_000_000 });
    if (rate.error) throw rate.error;
    // The Aromo is taken on those nights.
    const booked = await owner.client.rpc("create_booking", {
      p_unit: aromo,
      p_check_in: "2041-06-10",
      p_check_out: "2041-06-13",
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

  test("a visitor checks dates and gets a WhatsApp link with the stay", async ({ page }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "Cabañas del Arroyo" })).toBeVisible();
    await expect(page.getByText("Ingreso desde las 14:00 h")).toBeVisible();

    await page.getByLabel("Ingreso").fill("2041-06-10");
    await page.getByLabel("Salida").fill("2041-06-12");
    await page.getByLabel("Huéspedes").fill("2");
    await page.getByRole("button", { name: "Ver disponibilidad" }).click();

    await expect(page.getByText("Del 10/06/2041 al 12/06/2041: 2 noches, 2 huéspedes.")).toBeVisible();
    const sauce = page.getByRole("listitem").filter({ hasText: "Cabaña Sauce" }).filter({ hasText: "en total" });
    await expect(sauce).toContainText(/100\.000,00/);
    await expect(sauce).toContainText(/Seña sugerida: \$\s*30\.000,00/);
    await expect(page.getByRole("listitem").filter({ hasText: "Cabaña Aromo" }).filter({ hasText: "Ocupada" })).toBeVisible();

    const link = sauce.getByRole("link", { name: "Consultar por WhatsApp" });
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe("https://wa.me/5493544123456");
    expect(href.searchParams.get("text")).toBe(
      "Hola, quiero consultar por Cabaña Sauce en Cabañas del Arroyo, del 10/06/2041 al 12/06/2041, para 2 huéspedes.",
    );

    // Invariant 7: nothing about the booking's guest reaches the page.
    await expect(page.getByText("Huésped Privado")).toHaveCount(0);
    // Structured data for search engines.
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld).toMatchObject({ "@type": "LodgingBusiness", name: "Cabañas del Arroyo", address: { addressLocality: "Nono" } });

    // E2E_SHOTS=<dir> keeps full-page captures for a visual review of the public pages.
    if (process.env.E2E_SHOTS) {
      const project = test.info().project.name;
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/slug-${project}.png`, fullPage: true });
      await page.goto("/");
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/home-${project}.png`, fullPage: true });
    }
  });

  test("invalid dates explain what to fix", async ({ page }) => {
    await page.goto(`/${slug}?ingreso=2041-06-12&salida=2041-06-10&huespedes=2`);
    // Next.js adds its own empty role="alert" (route announcer): pick ours by its text.
    await expect(page.getByRole("alert").filter({ hasText: "Revisá las fechas" })).toContainText("la salida después del ingreso");
  });

  test("a draft is not found and a suspended account shows not available", async ({ page }) => {
    // The page streams, so the status may be 200: the not-found page and noindex are what count.
    await page.goto(`/${draftSlug}`);
    await expect(page.getByRole("heading", { name: "No encontramos ese alojamiento" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();

    const suspended = await superadmin.client.rpc("suspend_subscription", { p_org: orgId });
    expect(suspended.error).toBeNull();
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: "Este alojamiento no está disponible por ahora" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });

  test("the panel and the admin are kept out of search engines", async ({ page }) => {
    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/(\n|$)|Disallow: \/panel/);
    await page.goto("/auth/login");
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });
});
