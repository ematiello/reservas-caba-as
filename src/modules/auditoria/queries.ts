import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type AuditEntry = Database["public"]["Functions"]["audit_entries"]["Returns"][number];

export const AUDIT_PAGE = 50;

/**
 * One organization's log (its owner or the platform admin) or, with orgId null, every
 * organization's (platform admin). The database decides who may read it (audit_entries).
 */
export async function listAuditEntries(orgId: string | null, before?: number): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_entries", {
    ...(orgId ? { p_org: orgId } : {}),
    ...(before ? { p_before: before } : {}),
    p_limit: AUDIT_PAGE,
  });
  if (error) throw new Error("Could not load the audit log");
  return data;
}

/** Positive integer cursor from ?antes=, or undefined. */
export function cursorFrom(value: string | string[] | undefined): number | undefined {
  return typeof value === "string" && /^\d{1,18}$/.test(value) ? Number(value) : undefined;
}
