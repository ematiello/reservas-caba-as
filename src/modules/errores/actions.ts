"use server";

import { z } from "zod";

import { done } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

const PATH = "/admin/errores";

const schema = z.object({
  id: z.string().regex(/^\d{1,18}$/),
  status: z.enum(["open", "resolved", "ignored"]),
});

// Platform admin only. set_error_status checks it again in the database and writes the audit row.
export async function setErrorStatusAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = schema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) done(PATH, { error: "invalido" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_error_status", { p_id: Number(parsed.data.id), p_status: parsed.data.status });
  if (error) done(PATH, { error: error.code === "P0002" ? "inexistente" : "escritura" });
  done(PATH, { ok: parsed.data.status });
}
