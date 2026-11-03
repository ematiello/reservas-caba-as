import { createHash } from "node:crypto";

// Pure helpers behind the error log (odd/tasks/panel-errores-y-limpieza-dev.md, S1). Nothing here
// touches the network or the database, so the rules are pinned by sanitize.test.ts.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Strips what must not reach the log: emails, JWTs, Supabase keys, bearer tokens and runs of 7 or
 * more digits (phones, document and card numbers, with their spaces or dashes). Trims and truncates.
 */
export function sanitizeText(text: string, max: number): string {
  const clean = text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]")
    .replace(/sb_(?:secret|publishable)_[\w-]+/g, "[clave]")
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [token]")
    .replace(/\d(?:[ -]?\d){6,}/g, "[número]")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const MAX_ROUTE = 200;

/** The path without query or hash, ids replaced by :id, capped. Never stores what a user typed in a query. */
export function routeOf(path: string): string {
  const bare = path.split(/[?#]/, 1)[0].replace(UUID, ":id");
  return (bare || "/").slice(0, MAX_ROUTE);
}

export type FingerprintInput = {
  source: "server" | "browser";
  route: string;
  message: string;
  digest?: string | null;
};

/**
 * Same failure, same fingerprint. A digest (Next.js hashes the original error) wins over the message,
 * because production replaces Server Components messages with a generic text; without one, the
 * message is normalized so ids and counters do not split a group.
 */
export function fingerprintOf({ source, route, message, digest }: FingerprintInput): string {
  const basis = digest ? `digest:${digest}` : `message:${message.replace(UUID, ":id").replace(/\d+/g, "#")}`;
  return createHash("sha256").update(`${source}|${route}|${basis}`).digest("hex").slice(0, 32);
}

const EXPECTED_DIGESTS = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

/**
 * Redirects, 404s and dynamic rendering are how Next.js works, not failures: onRequestError also
 * receives them, and they would bury the real errors.
 */
export function isExpectedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { digest, message } = error as { digest?: unknown; message?: unknown };
  if (typeof digest === "string" && EXPECTED_DIGESTS.test(digest)) return true;
  return typeof message === "string" && message.startsWith("Dynamic server usage");
}
