// Captures the errors Next.js raises on the server (render, route handlers, server actions, proxy)
// into the platform's error log. Control flow such as redirects and 404s is skipped.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ isExpectedError }, { logError }] = await Promise.all([
    import("@/modules/errores/sanitize"),
    import("@/modules/errores/log"),
  ]);
  if (isExpectedError(error)) return;
  const err = error as { message?: unknown; digest?: unknown; stack?: unknown } | null;
  await logError({
    source: "server",
    message: typeof err?.message === "string" ? err.message : String(error),
    detail: [`${request.method} ${context.routeType}`, typeof err?.stack === "string" ? err.stack : ""].join("\n"),
    route: context.routePath || request.path,
    digest: typeof err?.digest === "string" ? err.digest : null,
  });
}
