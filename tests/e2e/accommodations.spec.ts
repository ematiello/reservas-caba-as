import { deflateSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, assertDbEnv, createTestUser, skipDbTests, uniqueSlug, type TestUser } from "../db/helpers";

// Phase 3 exit criterion: from a phone, the owner creates and publishes a property with two units
// and photos. Runs on the mobile and desktop projects.

// Solid-color RGB PNG built in memory, larger than the 1600 px limit so the resize path runs.
function png(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x5a)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.describe("accommodations", () => {
  assertDbEnv();
  test.skip(skipDbTests, "SKIP_DB_TESTS=1");
  // Each test resizes and uploads photos; the mobile project needs more than the default 30 s.
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let admin: SupabaseClient;
  let owner: TestUser;
  let orgId: string;
  let superadminId: string;
  const propertyName = `Cabañas E2E ${uniqueSlug("p")}`;
  const photo = png(2400, 1800);

  async function login(page: Page, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  test.beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "e2eacc");
    const superadmin = await createTestUser(admin, "e2eaccsuper");
    await admin.from("platform_admins").insert({ user_id: superadmin.id });
    const { data, error } = await owner.client.rpc("register_organization", { p_name: "Org acc", p_slug: uniqueSlug("e2eacc") });
    if (error) throw error;
    orgId = data as string;
    const approved = await superadmin.client.rpc("review_organization", { p_org: orgId, p_approve: true });
    if (approved.error) throw approved.error;
    // Deleted after the organization: organizations.approved_by references this user.
    superadminId = superadmin.id;
  });

  test.afterAll(async () => {
    const { data: files } = await admin.from("media").select("storage_path").eq("org_id", orgId);
    if (files?.length) await admin.storage.from("media").remove(files.map((f) => f.storage_path));
    await admin.from("audit_log").delete().eq("org_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    for (const id of [owner.id, superadminId]) await admin.auth.admin.deleteUser(id);
  });

  test("the owner creates and publishes a property with two units and photos", async ({ page }) => {
    await login(page, "/panel");
    await page.getByRole("link", { name: "Alojamientos" }).click();

    await page.getByLabel("Nombre del establecimiento").fill(propertyName);
    await page.getByRole("button", { name: "Crear establecimiento" }).click();
    await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();

    for (const name of ["Cabaña Norte", "Cabaña Sur"]) {
      await page.getByLabel("Nombre de la unidad").fill(name);
      await page.getByLabel("Huéspedes máximos").fill("4");
      await page.getByRole("button", { name: "Agregar unidad" }).click();
      await expect(page.getByText("Unidad agregada.")).toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }

    await page.getByLabel("Agregar fotos").setInputFiles([
      { name: "frente.png", mimeType: "image/png", buffer: photo },
      { name: "parque.png", mimeType: "image/png", buffer: photo },
    ]);
    await expect(page.getByText("Fotos subidas.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("img", { name: "Foto del alojamiento" })).toHaveCount(2);

    await page.getByLabel("WhatsApp (con código de país)").fill("+54 9 351 555-1234");
    await page.getByLabel("Localidad").fill("Villa Carlos Paz");
    await page.getByRole("button", { name: "Guardar datos" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    await page.getByRole("button", { name: "Publicar establecimiento" }).click();
    await expect(page.getByText("Establecimiento publicado.")).toBeVisible();

    const { data: property } = await admin
      .from("properties")
      .select("id, is_published, whatsapp, city")
      .eq("org_id", orgId)
      .single();
    expect(property).toMatchObject({ is_published: true, whatsapp: "5493515551234", city: "Villa Carlos Paz" });
    const { data: units } = await admin.from("units").select("name, is_published").eq("property_id", property!.id).order("name");
    expect(units).toEqual([
      { name: "Cabaña Norte", is_published: true },
      { name: "Cabaña Sur", is_published: true },
    ]);

    // The photos were resized and re-encoded in the browser: much smaller than the original PNG.
    const { data: media } = await admin.from("media").select("storage_path").eq("property_id", property!.id);
    expect(media).toHaveLength(2);
    for (const m of media!) {
      expect(m.storage_path).toMatch(new RegExp(`^${orgId}/${property!.id}/[0-9a-f-]+\\.(webp|jpg)$`));
      const { data: file } = await admin.storage.from("media").download(m.storage_path);
      expect(["image/webp", "image/jpeg"]).toContain(file!.type);
      expect(file!.size).toBeLessThan(photo.length);
    }

    // Visible to anonymous visitors now that it is published.
    const anon = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/properties?select=id&id=eq.${property!.id}`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } },
    );
    expect(await anon.json()).toEqual([{ id: property!.id }]);
  });

  test("a unit gets amenities and its own photo", async ({ page }) => {
    await login(page, "/panel/alojamientos");
    await page.getByRole("link", { name: new RegExp(propertyName) }).click();
    await page.getByRole("link", { name: /Cabaña Norte/ }).click();

    await page.getByLabel("Wi-Fi").check();
    await page.getByLabel("Parrilla").check();
    await page.getByRole("button", { name: "Guardar comodidades" }).click();
    await expect(page.getByText("Comodidades guardadas.")).toBeVisible();
    await expect(page.getByLabel("Wi-Fi")).toBeChecked();

    // Unchecking removes only that amenity.
    await page.getByLabel("Parrilla").uncheck();
    await page.getByRole("button", { name: "Guardar comodidades" }).click();
    // The notice from the first save is still on screen, so wait on the stored data instead.
    const { data: unit } = await admin.from("units").select("id").eq("org_id", orgId).eq("name", "Cabaña Norte").single();
    await expect
      .poll(async () => {
        const { data: kept } = await admin.from("unit_amenities").select("amenities(name)").eq("unit_id", unit!.id);
        return kept?.map((r) => (r.amenities as unknown as { name: string }).name);
      })
      .toEqual(["Wi-Fi"]);
    // Let the save's redirect settle before uploading: a late re-render would reset the uploader.
    await page.reload();
    await expect(page.getByLabel("Parrilla")).not.toBeChecked();
    await expect(page.getByLabel("Wi-Fi")).toBeChecked();

    // Client navigation keeps the previous route mounted but hidden (cacheComponents), so the
    // property page's uploader is still in the DOM: target the visible one.
    await page
      .getByLabel("Agregar fotos")
      .filter({ visible: true })
      .setInputFiles({ name: "interior.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByText("Fotos subidas.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("img", { name: "Foto del alojamiento" })).toHaveCount(1);
  });

  test("a suspended account sees the accommodations read-only", async ({ page }) => {
    const { error } = await admin.from("subscriptions").update({ status: "suspended" }).eq("org_id", orgId);
    if (error) throw error;
    await login(page, "/panel/alojamientos");
    await expect(page.getByText("los alojamientos quedan en solo lectura")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear establecimiento" })).toHaveCount(0);
    await page.getByRole("link", { name: new RegExp(propertyName) }).click();
    await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();
    await expect(page.getByRole("button", { name: /Publicar|Guardar datos/ }).filter({ visible: true })).toHaveCount(0);
  });
});
