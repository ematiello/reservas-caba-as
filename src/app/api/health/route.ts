import { getSupabasePublicEnv } from "@/lib/supabase/env";

// Deployment check: confirms the app runs and can reach Supabase. Never echoes keys or URLs.
export async function GET() {
  let supabase: "ok" | "unreachable" | "misconfigured";

  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    supabase = res.ok ? "ok" : "unreachable";
  } catch (error) {
    supabase =
      error instanceof Error && error.message.startsWith("Missing")
        ? "misconfigured"
        : "unreachable";
  }

  const ok = supabase === "ok";
  return Response.json(
    { status: ok ? "ok" : "degraded", supabase, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
