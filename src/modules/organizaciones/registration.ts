import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type RegistrationResult = "created" | "skipped" | "slug_taken" | "error";

// The business name and slug travel in the user's signup metadata, so the organization can be
// created once there is a session: right after signUp when email confirmation is off, or on the
// first confirmed login otherwise. Idempotent: it does nothing if the user already has a membership.
export async function completePendingRegistration(
  supabase: SupabaseClient<Database>,
): Promise<RegistrationResult> {
  const { data: userData } = await supabase.auth.getUser();
  const meta = userData.user?.user_metadata;
  const name = typeof meta?.org_name === "string" ? meta.org_name : "";
  const slug = typeof meta?.org_slug === "string" ? meta.org_slug : "";
  if (!userData.user || !name || !slug) return "skipped";

  const { count, error: countError } = await supabase
    .from("memberships")
    .select("org_id", { count: "exact", head: true });
  if (countError) return "error";
  if ((count ?? 0) > 0) return "skipped";

  const { error } = await supabase.rpc("register_organization", { p_name: name, p_slug: slug });
  if (!error) return "created";
  return error.code === "23505" ? "slug_taken" : "error";
}
