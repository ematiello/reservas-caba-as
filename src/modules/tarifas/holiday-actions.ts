"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

import { holidaySchema } from "./schemas";

// National holidays, shared by every property: platform admin only (docs/03). RLS checks it again
// and the audit trigger records each change.

const PATH = "/admin/feriados";

function done(result: { ok: string } | { error: string }): never {
  revalidatePath(PATH);
  redirect(`${PATH}?${"ok" in result ? `ok=${result.ok}` : `error=${result.error}`}`);
}

export async function addHolidayAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = holidaySchema.safeParse({ date: formData.get("date") ?? "", name: formData.get("name") ?? "" });
  if (!parsed.success) done({ error: "feriado_invalido" });
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert(parsed.data);
  if (error) done({ error: error.code === "23505" ? "feriado_repetido" : "feriado_error" });
  done({ ok: "feriado" });
}

export async function deleteHolidayAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = holidaySchema.shape.date.safeParse(formData.get("date") ?? "");
  if (!parsed.success) done({ error: "feriado_invalido" });
  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").delete().eq("date", parsed.data).select("date");
  if (error || !data.length) done({ error: "feriado_error" });
  done({ ok: "feriado_borrado" });
}
