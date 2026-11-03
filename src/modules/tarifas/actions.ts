"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireManagerAccess } from "@/modules/organizaciones/session";

import { discountSchema, rateRuleSchema } from "./schemas";

// Rates are configuration: owner/admin only (invariant 5). The organization comes from the caller's
// membership; RLS checks the role and a live subscription again, and composite foreign keys make the
// unit or category belong to the rule's property. Editing a rate never touches existing bookings:
// their price is frozen (invariant 8).

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

const ratesPath = (propertyId: string) => `/panel/alojamientos/${propertyId}/tarifas`;

function done(propertyId: string, result: { ok: string } | { error: string }): never {
  revalidatePath(ratesPath(propertyId));
  redirect(`${ratesPath(propertyId)}?${"ok" in result ? `ok=${result.ok}` : `error=${result.error}`}`);
}

function idFrom(formData: FormData, key: string): string {
  const parsed = z.uuid().safeParse(formData.get(key));
  if (!parsed.success) redirect("/panel/alojamientos");
  return parsed.data;
}

function ruleValues(r: z.infer<typeof rateRuleSchema>) {
  return {
    kind: r.kind,
    name: r.name,
    date_from: r.dateFrom,
    date_to: r.dateTo,
    price_cents: r.priceCents,
    guests_included: r.guestsIncluded,
    extra_guest_cents: r.extraGuestCents,
    min_nights: r.minNights,
    priority: r.priority,
  };
}

export async function createRateAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const parsed = rateRuleSchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyId, { error: "tarifa_invalida" });

  const supabase = await createClient();
  const { error } = await supabase.from("rate_rules").insert({
    org_id: org.orgId,
    property_id: propertyId,
    unit_id: parsed.data.unitId,
    category_id: parsed.data.categoryId,
    ...ruleValues(parsed.data),
  });
  if (error) done(propertyId, { error: "escritura" });
  done(propertyId, { ok: "tarifa_creada" });
}

export async function updateRateAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const ruleId = idFrom(formData, "ruleId");
  const parsed = rateRuleSchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyId, { error: "tarifa_invalida" });

  // Where the rule applies is fixed once created; the form sends it back unchanged.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rate_rules")
    .update(ruleValues(parsed.data))
    .eq("org_id", org.orgId)
    .eq("property_id", propertyId)
    .eq("id", ruleId)
    .select("id");
  if (error || !data.length) done(propertyId, { error: "escritura" });
  done(propertyId, { ok: "tarifa_guardada" });
}

export async function deleteRateAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const ruleId = idFrom(formData, "ruleId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rate_rules")
    .delete()
    .eq("org_id", org.orgId)
    .eq("property_id", propertyId)
    .eq("id", ruleId)
    .select("id");
  if (error || !data.length) done(propertyId, { error: "escritura" });
  done(propertyId, { ok: "tarifa_borrada" });
}

export async function createDiscountAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const parsed = discountSchema.safeParse(fields(formData));
  if (!parsed.success) done(propertyId, { error: "descuento_invalido" });

  const supabase = await createClient();
  const { error } = await supabase
    .from("length_discounts")
    .insert({ org_id: org.orgId, property_id: propertyId, min_nights: parsed.data.minNights, pct: parsed.data.pct });
  if (error) done(propertyId, { error: error.code === "23505" ? "descuento_repetido" : "escritura" });
  done(propertyId, { ok: "descuento_creado" });
}

export async function deleteDiscountAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  const propertyId = idFrom(formData, "propertyId");
  const discountId = idFrom(formData, "discountId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("length_discounts")
    .delete()
    .eq("org_id", org.orgId)
    .eq("property_id", propertyId)
    .eq("id", discountId)
    .select("id");
  if (error || !data.length) done(propertyId, { error: "escritura" });
  done(propertyId, { ok: "descuento_borrado" });
}
