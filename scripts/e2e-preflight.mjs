// Runs before the e2e build: fails in seconds when the dev Supabase project is unreachable, instead
// of building, starting the server and timing out test after test. Any HTTP answer counts as
// reachable (the health endpoint may answer 401 without a key); only a network failure stops the run.
//
// It ends by setting process.exitCode, never process.exit(): exiting while the response is still
// open trips a libuv assertion on Windows (exit code 127), which would break the webServer command.

const ATTEMPTS = 2;
// The dev project sometimes answers in 15 s or more.
const TIMEOUT_MS = 30_000;

async function reachable(target) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.body?.cancel();
      return { ok: true, status: res.status };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, error: lastError };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Missing credentials are reported by the tests themselves (assertDbEnv), with the full message.
if (process.env.SKIP_DB_TESTS !== "1" && url) {
  const target = new URL("/auth/v1/health", url);
  const result = await reachable(target);
  if (result.ok) {
    console.log(`e2e preflight: Supabase reachable (${target.host}, HTTP ${result.status})`);
  } else {
    const reason = result.error instanceof Error ? result.error.message : String(result.error);
    console.error(
      `e2e preflight: cannot reach Supabase at ${target.host} (${reason}). Check the network connection and run the suite again.`,
    );
    process.exitCode = 1;
  }
}
