"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

import { discountSchema, paymentSchema, planSchema, settingsSchema, subscriptionSettingsSchema } from "./schemas";

// Superadmin only. Each action checks requirePlatformAdmin() and the database checks
// is_platform_admin() again (RLS or the SECURITY DEFINER RPC), so a forged request fails twice.
// Results travel back as ?ok= / ?error= codes the page turns into messages.

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

function done(path: string, result: { ok: string } | { error: string }): never {
  revalidatePath(path);
  const query = "ok" in result ? `ok=${result.ok}` : `error=${result.error}`;
  redirect(`${path}?${query}`);
}

export async function savePlanAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const raw = fields(formData);
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) done("/admin/planes", { error: "plan_invalido" });
  const { name, priceCents, maxUnits, maxMembers, isActive } = parsed.data;
  const row = { name, price_cents: priceCents, max_units: maxUnits, max_members: maxMembers, is_active: isActive };

  const supabase = await createClient();
  const planId = z.uuid().safeParse(raw.planId);
  const { error } = planId.success
    ? await supabase.from("plans").update(row).eq("id", planId.data)
    : await supabase.from("plans").insert(row);
  if (error) done("/admin/planes", { error: error.code === "23505" ? "plan_duplicado" : "plan_error" });
  done("/admin/planes", { ok: "plan" });
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = settingsSchema.safeParse(fields(formData));
  if (!parsed.success) done("/admin/planes", { error: "ajustes_invalidos" });

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ trial_days: parsed.data.trialDays, default_grace_days: parsed.data.graceDays })
    .eq("id", true);
  if (error) done("/admin/planes", { error: "ajustes_error" });
  done("/admin/planes", { ok: "ajustes" });
}

function orgPath(orgId: string) {
  return `/admin/organizaciones/${orgId}`;
}

// The org id is validated before it becomes part of a redirect path.
function orgIdFrom(formData: FormData): string {
  const parsed = z.uuid().safeParse(formData.get("orgId"));
  if (!parsed.success) redirect("/admin");
  return parsed.data;
}

export async function recordPaymentAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const orgId = orgIdFrom(formData);
  const parsed = paymentSchema.safeParse(fields(formData));
  if (!parsed.success) done(orgPath(orgId), { error: "pago_invalido" });
  const p = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_subscription_payment", {
    p_org: p.orgId,
    p_amount_cents: p.amountCents,
    p_method: p.method,
    p_paid_at: p.paidAt,
    p_months: p.months,
    p_notes: p.notes ?? undefined,
  });
  if (error) done(orgPath(orgId), { error: "pago_error" });
  done(orgPath(orgId), { ok: "pago" });
}

export async function updateSubscriptionAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const orgId = orgIdFrom(formData);
  const parsed = subscriptionSettingsSchema.safeParse(fields(formData));
  if (!parsed.success) done(orgPath(orgId), { error: "suscripcion_invalida" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ plan_id: parsed.data.planId, grace_days: parsed.data.graceDays })
    .eq("org_id", parsed.data.orgId)
    .select("id");
  if (error || !data?.length) done(orgPath(orgId), { error: "suscripcion_error" });
  done(orgPath(orgId), { ok: "suscripcion" });
}

export async function updateDiscountAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const orgId = orgIdFrom(formData);
  const parsed = discountSchema.safeParse(fields(formData));
  if (!parsed.success) done(orgPath(orgId), { error: "descuento_invalido" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ discount_pct: parsed.data.pct, discount_cents: parsed.data.cents, discount_until: parsed.data.until })
    .eq("org_id", parsed.data.orgId)
    .select("id");
  if (error || !data?.length) done(orgPath(orgId), { error: "descuento_error" });
  done(orgPath(orgId), { ok: "descuento" });
}

export async function suspendSubscriptionAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const orgId = orgIdFrom(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_subscription", { p_org: orgId });
  if (error) done(orgPath(orgId), { error: "suspension_error" });
  done(orgPath(orgId), { ok: "suspension" });
}
