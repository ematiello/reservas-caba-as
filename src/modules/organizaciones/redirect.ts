const FALLBACK = "/panel";

// Internal /panel or /admin path, optional sub-path and query. No scheme, host or backslash.
const ALLOWED = /^\/(panel|admin)(\/[\w.~%/-]*)?(\?[^\s#\\]*)?$/;

// Post-login redirect target taken from the query string: only same-site private routes.
export function safeNext(next: string | null | undefined): string {
  if (!next || next.includes("..") || !ALLOWED.test(next)) return FALLBACK;
  return next;
}
