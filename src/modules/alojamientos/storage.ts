import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { logError } from "@/modules/errores/log";

/**
 * Removes photo files after their rows are gone. The rows are already deleted, so a failure here
 * never fails the user's action: it is recorded in the error log (/admin/errores) with the paths
 * left behind, so the orphan files can be removed by hand.
 */
export async function removeMediaFiles(
  client: SupabaseClient<Database>,
  paths: string[],
  context: { action: string; route: string; orgId: string },
): Promise<void> {
  if (!paths.length) return;
  let failure: string | null;
  try {
    const { data, error } = await client.storage.from("media").remove(paths);
    const removed = data?.length ?? 0;
    failure = error ? error.message : removed < paths.length ? `${paths.length - removed} of ${paths.length} not removed` : null;
  } catch (cause) {
    failure = cause instanceof Error ? cause.message : "Storage request failed";
  }
  if (!failure) return;
  await logError({
    source: "server",
    severity: "warning",
    message: `Could not remove photo files from Storage (${context.action})`,
    detail: `${failure}. Paths: ${paths.join(", ")}`,
    route: context.route,
    orgId: context.orgId,
  });
}
