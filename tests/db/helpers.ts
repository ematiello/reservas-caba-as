import { createHash, randomBytes } from "node:crypto";

import { createClient, isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";

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

const NETWORK_DELAYS_MS = [1_000, 3_000, 9_000];
// Supabase Auth limits sign-ins per time window; the allowance refills slowly, so wait longer.
const RATE_LIMIT_DELAYS_MS = [10_000, 20_000, 40_000, 60_000];

function isRateLimit(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string } | null;
  return e?.status === 429 || e?.code === "over_request_rate_limit" || /rate limit/i.test(e?.message ?? "");
}

/**
 * Runs a request and retries, with a bounded wait, only the failures a pause fixes: dropped
 * connections (AuthRetryableFetchError) and the Auth rate limit. Real API errors fail at once.
 */
async function withRetry<R extends { error: unknown }>(run: () => Promise<R>): Promise<R> {
  let network = 0;
  let limited = 0;
  for (;;) {
    let result: R;
    try {
      result = await run();
    } catch (error) {
      result = { error } as R;
    }
    const error = result.error;
    if (!error) return result;
    const delay = isAuthRetryableFetchError(error)
      ? NETWORK_DELAYS_MS[network++]
      : isRateLimit(error)
        ? RATE_LIMIT_DELAYS_MS[limited++]
        : undefined;
    if (delay === undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export async function createTestUser(admin: SupabaseClient, label: string): Promise<TestUser> {
  const password = randomBytes(16).toString("hex");
  let email = "";
  // Every attempt uses a fresh email, so a request that reached the server before a drop cannot
  // collide with its own retry.
  const created = await withRetry(() => {
    email = `rls-${label}-${randomBytes(4).toString("hex")}@example.com`;
    return admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${label}` } });
  });
  if (created.error) throw created.error;
  const client = anonClient();
  // Signing in is the call the rate limit hits; the user already exists, so only this is retried.
  const signedIn = await withRetry(() => client.auth.signInWithPassword({ email, password }));
  if (signedIn.error) {
    await admin.auth.admin.deleteUser(created.data.user!.id);
    throw signedIn.error;
  }
  return { id: created.data.user!.id, email, password, client };
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}
