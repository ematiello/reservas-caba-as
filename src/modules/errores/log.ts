import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { fingerprintOf, routeOf, sanitizeText } from "./sanitize";

export type ErrorReport = {
  source: "server" | "browser";
  message: string;
  detail?: string | null;
  route?: string | null;
  digest?: string | null;
  orgId?: string | null;
  userId?: string | null;
  severity?: "error" | "warning";
};

/**
 * Records an error in the platform's error log (grouped by fingerprint, see log_error in the
 * database). It never throws and never logs through itself: a failure of the logger must not turn
 * into another failure of the request that was already failing.
 */
export async function logError(report: ErrorReport): Promise<void> {
  try {
    const message = sanitizeText(report.message || "Unknown error", 500);
    const route = routeOf(report.route ?? "/");
    const digest = report.digest ? report.digest.slice(0, 100) : null;
    const fingerprint = fingerprintOf({ source: report.source, route, message, digest });
    const { error } = await createAdminClient().rpc("log_error", {
      p_fingerprint: fingerprint,
      p_source: report.source,
      p_severity: report.severity ?? "error",
      p_message: message,
      p_detail: report.detail ? sanitizeText(report.detail, 2000) : undefined,
      p_route: route,
      p_digest: digest ?? undefined,
      p_org: report.orgId ?? undefined,
      p_user: report.userId ?? undefined,
    });
    if (error) console.error("[error-log] could not record the error:", error.message);
  } catch (cause) {
    console.error("[error-log] could not record the error:", cause instanceof Error ? cause.message : cause);
  }
}
