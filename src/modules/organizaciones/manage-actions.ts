"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { organizationNameSchema } from "./schemas";
import { requireOwnerAccess } from "./session";

// Owner only. The organization always comes from the caller's membership, never from the form; the
// RPCs check the owner role (and, to rename, a live account) again in the database.

function done(path: string, result: { ok: string } | { error: string }): never {
  revalidatePath(path);
  redirect(`${path}?${"ok" in result ? `ok=${result.ok}` : `error=${result.error}`}`);
}

const ORG = "/panel/organizacion";
const SUBSCRIPTION = "/panel/suscripcion";

export async function updateOrganizationAction(formData: FormData): Promise<void> {
  const { org } = await requireOwnerAccess();
  const parsed = organizationNameSchema.safeParse({ orgName: formData.get("orgName") ?? "" });
  if (!parsed.success) done(ORG, { error: "nombre_invalido" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization", { p_org: org.orgId, p_name: parsed.data.orgName });
  if (error) done(ORG, { error: "escritura" });
  revalidatePath("/panel", "layout");
  done(ORG, { ok: "guardado" });
}

export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  const { org } = await requireOwnerAccess();
  if (formData.get("confirm") !== "on") done(SUBSCRIPTION, { error: "confirmar_baja" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_subscription", { p_org: org.orgId });
  if (error) done(SUBSCRIPTION, { error: "baja_error" });
  revalidatePath("/panel", "layout");
  done(SUBSCRIPTION, { ok: "baja" });
}
