"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireManagerAccess, requirePlatformAdmin } from "@/modules/organizaciones/session";

import { holidaySchema } from "./schemas";

// Holidays are national (platform admin, every property uses them) or an organization's own (its
// owner or admin, only its properties use them). RLS checks the same split again and the audit
// trigger records each change. The organization always comes from the caller's membership.

const ADMIN_PATH = "/admin/feriados";
const PANEL_PATH = "/panel/feriados";

function done(path: string, result: { ok: string } | { error: string }): never {
  revalidatePath(path);
  redirect(`${path}?${"ok" in result ? `ok=${result.ok}` : `error=${result.error}`}`);
}

async function insertHoliday(path: string, orgId: string | null, formData: FormData): Promise<never> {
  const parsed = holidaySchema.safeParse({ date: formData.get("date") ?? "", name: formData.get("name") ?? "" });
  if (!parsed.success) done(path, { error: "feriado_invalido" });
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({ ...parsed.data, org_id: orgId });
  if (error) done(path, { error: error.code === "23505" ? "feriado_repetido" : "feriado_error" });
  done(path, { ok: "feriado" });
}

async function removeHoliday(path: string, orgId: string | null, formData: FormData): Promise<never> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) done(path, { error: "feriado_invalido" });
  const supabase = await createClient();
  const query = supabase.from("holidays").delete().eq("id", id.data);
  const { data, error } = await (orgId ? query.eq("org_id", orgId) : query.is("org_id", null)).select("id");
  if (error || !data.length) done(path, { error: "feriado_error" });
  done(path, { ok: "feriado_borrado" });
}

export async function addHolidayAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  await insertHoliday(ADMIN_PATH, null, formData);
}

export async function deleteHolidayAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  await removeHoliday(ADMIN_PATH, null, formData);
}

export async function addOrgHolidayAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  await insertHoliday(PANEL_PATH, org.orgId, formData);
}

export async function deleteOrgHolidayAction(formData: FormData): Promise<void> {
  const { org } = await requireManagerAccess();
  await removeHoliday(PANEL_PATH, org.orgId, formData);
}
