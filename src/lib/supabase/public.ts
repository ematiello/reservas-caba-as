import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// Anonymous client for the public pages: no cookies and no session, so it reads exactly what any
// visitor may read (RLS `anon` policies) and can run inside "use cache".
export function createPublicClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
