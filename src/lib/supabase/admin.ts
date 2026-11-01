import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// service_role client: bypasses RLS. Server only, and only for internal tasks the user session must
// not do itself (CLAUDE.md), such as writing a booking's frozen price after the caller's access was
// checked with their own session. Never import it from client code or pass it user-chosen filters
// without scoping them to the caller's organization.
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing SUPABASE_SECRET_KEY (server-only, see .env.example).");
  return createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
