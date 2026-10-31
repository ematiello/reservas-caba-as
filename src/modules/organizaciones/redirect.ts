const FALLBACK = "/panel";

// Internal /panel or /admin path, optional sub-path and query. No scheme, host or backslash.
const PRIVATE_AREA = /^\/(panel|admin)(\/[\w.~%/-]*)?(\?[^\s#\\]*)?$/;

// Invitation links (D21): /auth/invitacion/<base64url token>. Nothing else under /auth.
const INVITATION = /^\/auth\/invitacion\/[A-Za-z0-9_-]{16,64}$/;

// Post-login redirect target taken from the query string: only same-site private routes
// or an invitation link.
export function safeNext(next: string | null | undefined): string {
  if (!next || next.includes("..")) return FALLBACK;
  return PRIVATE_AREA.test(next) || INVITATION.test(next) ? next : FALLBACK;
}
