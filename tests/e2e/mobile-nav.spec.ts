import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Bottom navigation bar on phones (below `md`) for every kind of user, and the installable web app.

test.describe("public bottom bar", () => {
  test("phones get a fixed bar on the home page and on the sign-in page", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone viewport only");
    for (const path of ["/", "/auth/login"]) {
      await page.goto(path);
      const bar = page.getByRole("navigation", { name: "Navegación principal" });
      await expect(bar).toBeVisible();
      await expect(bar.getByRole("link")).toHaveText(["Inicio", "Buscar", "Publicar", "Ingresar"]);
    }
  });

  test("the current page is marked and the bar navigates", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone viewport only");
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(bar.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

    await bar.getByRole("link", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/\/buscar$/);
    await expect(bar.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
    await expect(bar.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
  });

  test("desktop does not get the bottom bar", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop viewport only");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeHidden();
  });
});

test.describe("installable web app", () => {
  test("the manifest names the app and its icons are real images", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("Reservas Traslasierra");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");

    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    for (const icon of manifest.icons as { src: string }[]) {
      const image = await request.get(icon.src);
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("the page declares the theme color, the viewport and the iOS icon", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", /#[0-9a-f]{6}/i);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
  });

  test("an unknown icon size is a 404, not an error", async ({ request }) => {
    expect((await request.get("/pwa-icon/__proto__")).status()).toBe(404);
    expect((await request.get("/pwa-icon/999")).status()).toBe(404);
  });
});

test.describe("owner panel navigation", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let owner: TestUser;
  let orgId: string;

  async function login(page: Page, user: TestUser, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    const superadmin = await createTestUser(admin, "navsuper");
    owner = await createTestUser(admin, "navowner");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });

    const registered = await owner.client.rpc("register_organization", {
      p_name: "Navegacion E2E",
      p_slug: uniqueSlug("nav"),
    });
    orgId = registered.data as string;
    await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    await admin.auth.admin.deleteUser(superadmin.id);
  });

  test.afterAll(async () => {
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(owner.id);
  });

  test("on a phone the owner gets four items plus 'Más', and the rest sits in the sheet", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone viewport only");
    await login(page, owner, "/panel");

    const bar = page.getByRole("navigation", { name: "Panel", exact: true });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link")).toHaveText(["Inicio", "Reservas", "Huéspedes", "Alojamientos"]);
    await expect(bar.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

    await bar.getByRole("button", { name: "Más" }).click();
    const sheet = page.getByRole("dialog", { name: "Más opciones" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link")).toHaveText(["Feriados", "Equipo", "Suscripción", "Organización"]);

    await sheet.getByRole("link", { name: "Equipo" }).click();
    await expect(page).toHaveURL(/\/panel\/equipo$/);
    await expect(sheet).toBeHidden();
  });

  test("the sheet closes with Escape and with 'Cerrar'", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone viewport only");
    await login(page, owner, "/panel");
    const bar = page.getByRole("navigation", { name: "Panel", exact: true });
    const sheet = page.getByRole("dialog", { name: "Más opciones" });

    await bar.getByRole("button", { name: "Más" }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await bar.getByRole("button", { name: "Más" }).click();
    await sheet.getByRole("button", { name: "Cerrar" }).click();
    await expect(sheet).toBeHidden();
  });

  test("the last content of a page is not hidden under the bar", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone viewport only");
    await login(page, owner, "/panel/equipo");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const bar = await page.getByRole("navigation", { name: "Panel", exact: true }).boundingBox();
    expect(bar).not.toBeNull();
    // Bottom edge of the last element inside <main> that takes space (some children are empty or hidden).
    const contentBottom = await page.evaluate(() => {
      const children = Array.from(document.querySelectorAll("main > *"));
      const bottoms = children.map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0);
      return bottoms.length ? Math.max(...bottoms.map((r) => r.bottom)) : null;
    });
    expect(contentBottom).not.toBeNull();
    // <main> keeps padding under its content for the bar: once scrolled down, the content ends above it.
    expect(contentBottom!).toBeLessThanOrEqual(bar!.y + 1);
  });

  test("on desktop the tabs stay at the top and there is no bottom bar", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop viewport only");
    await login(page, owner, "/panel");

    const bars = page.getByRole("navigation", { name: "Panel", exact: true });
    await expect(bars).toHaveCount(1);
    await expect(bars.getByRole("link", { name: "Equipo" })).toBeVisible();
    await expect(bars.getByRole("button", { name: "Más" })).toHaveCount(0);
  });
});
