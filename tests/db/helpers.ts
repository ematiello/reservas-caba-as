import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const hasDbEnv = Boolean(url && publishableKey && secretKey);

export const skipDbTests = process.env.SKIP_DB_TESTS === "1";

// Missing credentials must fail the run, never skip silently (a green run with zero assertions
// hides a broken isolation gate). The only way to skip is the explicit SKIP_DB_TESTS=1.
export function assertDbEnv(): void {
  if (!hasDbEnv && !skipDbTests) {
    throw new Error(
      "DB-backed tests need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and " +
        "SUPABASE_SECRET_KEY (dev project, see .env.example). Set SKIP_DB_TESTS=1 to skip them on purpose.",
    );
  }
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS: only for test setup and cleanup, never for assertions. */
export function adminClient(): SupabaseClient {
  return createClient(url!, secretKey!, options);
}

export function anonClient(): SupabaseClient {
  return createClient(url!, publishableKey!, options);
}

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient };

export async function createTestUser(admin: SupabaseClient, label: string): Promise<TestUser> {
  const email = `rls-${label}-${randomBytes(4).toString("hex")}@example.com`;
  const password = randomBytes(16).toString("hex");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (created.error) throw created.error;
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { id: created.data.user.id, email, password, client };
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}
