"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { done as finish } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result-url";
import { createClient } from "@/lib/supabase/server";
import { requireManagerAccess } from "@/modules/organizaciones/session";
import { PUBLIC_PROPERTIES_TAG } from "@/modules/publico/tags";

// Cross references are enforced by the database, not re-checked here: composite foreign keys make
// units.category_id belong to the unit's property and media.unit_id to the photo's property
// (supabase/migrations/20261101154414_accommodations.sql, lines 75 and 104), and org_id to the
// parent's organization. tests/db/accommodations.test.ts proves each one fails with 23503.
import { isMediaPath } from "./image";
import { categorySchema, newPropertySchema, propertySchema, unitSchema } from "./schemas";
import { removeMediaFiles } from "./storage";

// Owner/admin only. The organization always comes from the caller's membership, never from the
// form; RLS checks owner/admin and a live subscription again. Results travel as ?ok= / ?error=.

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

// The public pages show this data from a cache: the owner sees their change there right away.
function done(path: string, result: ActionResult): never {
  return finish(path, result, { tags: [PUBLIC_PROPERTIES_TAG] });
}

const LIST = "/panel/alojamientos";

function idFrom(formData: FormData, key: string): string {
  const parsed = z.uuid().safeParse(formData.get(key));
  if (!parsed.success) redirect(LIST);
  return parsed.data;
}

const propertyPath = (id: string) => `${LIST}/${id}`;
const unitPath = (propertyId: string, unitId: string) => `${LIST}/${propertyId}/unidades/${unitId}`;

export async function createPropertyAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const parsed = newPropertySchema.safeParse(fields(formData));
  if (!parsed.success) done(LIST, { error: "establecimiento_invalido" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({ org_id: org.orgId, name: parsed.data.name, slug: parsed.data.slug })
    .select("id")
    .single();
  if (error) done(LIST, { error: error.code === "23505" ? "direccion_en_uso" : "escritura" });
  redirect(propertyPath(data.id));
}

export async function updatePropertyAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  const parsed = propertySchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyPath(id), { error: "datos_invalidos" });
  const p = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update({
      name: p.name,
      description: p.description,
      address: p.address,
      city: p.city,
      province: p.province,
      lat: p.lat,
      lng: p.lng,
      whatsapp: p.whatsapp,
      check_in_time: p.checkInTime,
      check_out_time: p.checkOutTime,
      cleaning_buffer_days: p.cleaningBufferDays,
      provisional_hold_hours: p.provisionalHoldHours,
      deposit_pct: p.depositPct,
    })
    .eq("org_id", org.orgId)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) done(propertyPath(id), { error: "escritura" });
  done(propertyPath(id), { ok: "guardado" });
}

export async function setPropertyPublishedAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  const publish = formData.get("publish") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update({ is_published: publish })
    .eq("org_id", org.orgId)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) done(propertyPath(id), { error: "escritura" });
  done(propertyPath(id), { ok: publish ? "publicado" : "despublicado" });
}

// Only an establishment without bookings or blocks can be deleted: bookings reference it without
// cascade (they are history, never erased), so the database refuses with 23503 and the owner is told
// to unpublish it instead. Rates, categories, units and photos go with it; the photo files too.
export async function deletePropertyAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  if (formData.get("confirm") !== "on") done(propertyPath(id), { error: "confirmar_borrado" });
  const supabase = await createClient();
  const photos = await supabase.from("media").select("storage_path").eq("org_id", org.orgId).eq("property_id", id);
  if (photos.error) done(propertyPath(id), { error: "escritura" });
  const { data, error } = await supabase.from("properties").delete().eq("org_id", org.orgId).eq("id", id).select("id");
  if (error) done(propertyPath(id), { error: error.code === "23503" ? "establecimiento_con_reservas" : "escritura" });
  if (!data?.length) done(propertyPath(id), { error: "escritura" });
  // The storage policy needs the property to exist, so the files go after it with the server-only
  // client, limited to the paths this session read from its own organization.
  const paths = photos.data.map((m) => m.storage_path).filter((path) => path.startsWith(`${org.orgId}/${id}/`));
  await removeMediaFiles(createAdminClient(), paths, { action: "deleteProperty", route: propertyPath(id), orgId: org.orgId });
  done(LIST, { ok: "establecimiento_borrado" });
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  const parsed = categorySchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyPath(id), { error: "categoria_invalida" });
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_categories")
    .insert({ org_id: org.orgId, property_id: id, ...parsed.data });
  if (error) done(propertyPath(id), { error: "escritura" });
  done(propertyPath(id), { ok: "categoria" });
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  const categoryId = idFrom(formData, "categoryId");
  const parsed = categorySchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyPath(id), { error: "categoria_invalida" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_categories")
    .update(parsed.data)
    .eq("org_id", org.orgId)
    .eq("property_id", id)
    .eq("id", categoryId)
    .select("id");
  if (error || !data?.length) done(propertyPath(id), { error: "escritura" });
  done(propertyPath(id), { ok: "categoria_guardada" });
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  const categoryId = idFrom(formData, "categoryId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_categories")
    .delete()
    .eq("org_id", org.orgId)
    .eq("id", categoryId)
    .select("id");
  if (error || !data?.length) done(propertyPath(id), { error: "escritura" });
  done(propertyPath(id), { ok: "categoria_borrada" });
}

function unitRow(u: z.infer<typeof unitSchema>) {
  return {
    name: u.name,
    kind: u.kind,
    max_guests: u.maxGuests,
    bedrooms: u.bedrooms,
    beds: u.beds,
    category_id: u.categoryId,
    description: u.description,
    is_published: u.isPublished,
  };
}

export async function createUnitAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const id = idFrom(formData, "propertyId");
  const parsed = unitSchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyPath(id), { error: "unidad_invalida" });
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .insert({ org_id: org.orgId, property_id: id, ...unitRow(parsed.data) });
  if (error) done(propertyPath(id), { error: error.message.includes("unit limit reached") ? "limite_unidades" : "escritura" });
  done(propertyPath(id), { ok: "unidad" });
}

export async function updateUnitAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const unitId = idFrom(formData, "unitId");
  const parsed = unitSchema.safeParse(fields(formData));
  if (!parsed.success) done(unitPath(propertyId, unitId), { error: "unidad_invalida" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .update(unitRow(parsed.data))
    .eq("org_id", org.orgId)
    .eq("id", unitId)
    .select("id");
  if (error || !data?.length) done(unitPath(propertyId, unitId), { error: "escritura" });
  done(unitPath(propertyId, unitId), { ok: "guardado" });
}

export async function deleteUnitAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const unitId = idFrom(formData, "unitId");
  const supabase = await createClient();
  // Read the files first: the rows go with the unit (cascade) and nothing would point to them after.
  const files = await supabase.from("media").select("storage_path").eq("org_id", org.orgId).eq("unit_id", unitId);
  if (files.error) done(unitPath(propertyId, unitId), { error: "escritura" });
  const media = files.data;
  const { data, error } = await supabase.from("units").delete().eq("org_id", org.orgId).eq("id", unitId).select("id");
  if (error || !data?.length) done(unitPath(propertyId, unitId), { error: "escritura" });
  // Media rows go with the unit (cascade); remove their files too.
  await removeMediaFiles(supabase, media.map((m) => m.storage_path), {
    action: "deleteUnit",
    route: unitPath(propertyId, unitId),
    orgId: org.orgId,
  });
  done(propertyPath(propertyId), { ok: "unidad_borrada" });
}

export async function setUnitAmenitiesAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const unitId = idFrom(formData, "unitId");
  // Reject the whole request on a malformed id: dropping it would delete that amenity instead.
  const parsedIds = z.array(z.uuid()).safeParse(formData.getAll("amenityId"));
  if (!parsedIds.success) done(unitPath(propertyId, unitId), { error: "escritura" });
  const ids = parsedIds.data;

  // Add the selected ones first, then remove the rest: a failure halfway never wipes the list.
  const supabase = await createClient();
  if (ids.length) {
    const { error } = await supabase
      .from("unit_amenities")
      .upsert(
        ids.map((amenity_id) => ({ org_id: org.orgId, unit_id: unitId, amenity_id })),
        { onConflict: "unit_id,amenity_id", ignoreDuplicates: true },
      );
    if (error) done(unitPath(propertyId, unitId), { error: "escritura" });
  }
  let stale = supabase.from("unit_amenities").delete().eq("org_id", org.orgId).eq("unit_id", unitId);
  if (ids.length) stale = stale.not("amenity_id", "in", `(${ids.join(",")})`);
  const removed = await stale;
  if (removed.error) done(unitPath(propertyId, unitId), { error: "escritura" });
  done(unitPath(propertyId, unitId), { ok: "comodidades" });
}

const mediaInput = z.object({
  propertyId: z.uuid(),
  unitId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  storagePath: z.string().max(300),
  alt: z.string().trim().max(200),
});

// Called by the uploader after the browser stored the resized file in Storage.
export async function registerMediaAction(input: z.input<typeof mediaInput>): Promise<{ error?: string }> {
  const { org } = await requireManagerAccess();
  const parsed = mediaInput.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { propertyId, unitId, storagePath, alt } = parsed.data;
  if (!isMediaPath(org.orgId, propertyId, storagePath)) return { error: "invalid" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.orgId)
    .eq("property_id", propertyId);
  const { error } = await supabase.from("media").insert({
    org_id: org.orgId,
    property_id: propertyId,
    unit_id: unitId,
    storage_path: storagePath,
    alt,
    sort: count ?? 0,
  });
  if (error) {
    await removeMediaFiles(supabase, [storagePath], {
      action: "registerMedia",
      route: propertyPath(propertyId),
      orgId: org.orgId,
    });
    return { error: "write" };
  }
  revalidatePath(unitId ? unitPath(propertyId, unitId) : propertyPath(propertyId));
  updateTag(PUBLIC_PROPERTIES_TAG);
  return {};
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const mediaId = idFrom(formData, "mediaId");
  const back = formData.get("back") === "unit" ? unitPath(propertyId, idFrom(formData, "unitId")) : propertyPath(propertyId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .delete()
    .eq("org_id", org.orgId)
    .eq("id", mediaId)
    .select("storage_path");
  if (error || !data?.length) done(back, { error: "escritura" });
  await removeMediaFiles(supabase, data.map((m) => m.storage_path), { action: "deleteMedia", route: back, orgId: org.orgId });
  done(back, { ok: "foto_borrada" });
}
