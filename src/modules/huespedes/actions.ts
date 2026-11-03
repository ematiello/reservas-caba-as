"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireActiveMembership } from "@/modules/organizaciones/session";

import { guestSchema } from "./schemas";

// Any member keeps guest contact data up to date (docs/03: guests are written by every role of an
// active organization). The organization comes from the membership; RLS checks it again.

export async function updateGuestAction(formData: FormData): Promise<void> {
  const { org } = await requireActiveMembership();
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
  const parsed = guestSchema.safeParse(values);
  if (!parsed.success) {
    const id = typeof values.guestId === "string" && /^[0-9a-f-]{36}$/i.test(values.guestId) ? values.guestId : null;
    redirect(id ? `/panel/huespedes/${id}?error=datos_invalidos` : "/panel/huespedes");
  }
  const g = parsed.data;
  const path = `/panel/huespedes/${g.guestId}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .update({ full_name: g.fullName, phone: g.phone, email: g.email, notes: g.notes })
    .eq("org_id", org.orgId)
    .eq("id", g.guestId)
    .select("id");
  revalidatePath("/panel/huespedes", "layout");
  revalidatePath("/panel/reservas", "layout");
  redirect(`${path}?${error || !data.length ? "error=escritura" : "ok=guardado"}`);
}
