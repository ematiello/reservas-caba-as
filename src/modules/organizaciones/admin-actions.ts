"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { addDays } from "@/modules/reservas/calendar";

import { organizationEditSchema } from "./schemas";
import { requirePlatformAdmin } from "./session";

// Platform admin only. Each action checks requirePlatformAdmin() and the RPC checks
// is_platform_admin() again; every change lands in the audit log through the table triggers.

function done(path: string, result: { ok: string } | { error: string }): never {
  revalidatePath(path);
  redirect(`${path}?${"ok" in result ? `ok=${result.ok}` : `error=${result.error}`}`);
}

const ADMINS = "/admin/administradores";

// The org id is validated before it becomes part of a redirect path.
function orgPathFrom(formData: FormData): { orgId: string; path: string } {
  const parsed = z.uuid().safeParse(formData.get("orgId"));
  if (!parsed.success) redirect("/admin");
  return { orgId: parsed.data, path: `/admin/organizaciones/${parsed.data}` };
}

export async function adminUpdateOrganizationAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const { orgId, path } = orgPathFrom(formData);
  const parsed = organizationEditSchema.safeParse({ orgName: formData.get("orgName") ?? "", slug: formData.get("slug") ?? "" });
  if (!parsed.success) done(path, { error: "organizacion_invalida" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization", {
    p_org: orgId,
    p_name: parsed.data.orgName,
    p_slug: parsed.data.slug,
  });
  if (error) done(path, { error: error.code === "23505" ? "direccion_en_uso" : "organizacion_error" });
  revalidatePath("/admin");
  done(path, { ok: "organizacion" });
}

export async function setOrganizationDisabledAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const { orgId, path } = orgPathFrom(formData);
  const disable = formData.get("disabled") === "true";
  if (disable && formData.get("confirm") !== "on") done(path, { error: "confirmar_desactivar" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organization_disabled", { p_org: orgId, p_disabled: disable });
  if (error) done(path, { error: "desactivar_error" });
  revalidatePath("/admin");
  done(path, { ok: disable ? "desactivada" : "activada" });
}

export async function adminCancelSubscriptionAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const { orgId, path } = orgPathFrom(formData);
  if (formData.get("confirm") !== "on") done(path, { error: "confirmar_baja" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_subscription", { p_org: orgId });
  if (error) done(path, { error: "baja_error" });
  revalidatePath("/admin");
  done(path, { ok: "baja" });
}

export async function reactivateSubscriptionAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const { orgId, path } = orgPathFrom(formData);
  // The form asks for the last active day; the period end is exclusive, like every stay.
  const lastDay = z.iso.date().safeParse(formData.get("until"));
  if (!lastDay.success) done(path, { error: "reactivacion_fecha" });
  const supabase = await createClient();
  // The database bounds the end (after today, at most 731 days ahead): 22023 otherwise.
  const { error } = await supabase.rpc("reactivate_subscription", { p_org: orgId, p_until: addDays(lastDay.data, 1) });
  if (error) done(path, { error: error.code === "22023" ? "reactivacion_fecha" : "reactivacion_error" });
  revalidatePath("/admin");
  done(path, { ok: "reactivada" });
}

export async function grantPlatformAdminAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const email = z.string().trim().toLowerCase().pipe(z.email()).safeParse(formData.get("email") ?? "");
  if (!email.success) done(ADMINS, { error: "email_invalido" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_platform_admin", { p_email: email.data });
  if (error) done(ADMINS, { error: error.code === "P0002" ? "sin_cuenta" : "alta_error" });
  done(ADMINS, { ok: "alta" });
}

export async function revokePlatformAdminAction(formData: FormData): Promise<void> {
  const access = await requirePlatformAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) done(ADMINS, { error: "quitar_error" });
  if (userId.data === access.user.id) done(ADMINS, { error: "quitar_propio" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_platform_admin", { p_user: userId.data });
  if (error) done(ADMINS, { error: error.code === "P0001" ? "quitar_propio" : "quitar_error" });
  done(ADMINS, { ok: "quitado" });
}
